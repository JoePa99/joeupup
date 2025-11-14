import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, companyId } = await req.json();
    
    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'Website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Analyzing website:', websiteUrl);

    // Fetch website content
    const websiteResponse = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!websiteResponse.ok) {
      throw new Error(`Failed to fetch website: ${websiteResponse.status}`);
    }

    const htmlContent = await websiteResponse.text();
    
    // Enhanced content extraction
    let textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract metadata for better analysis
    const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descriptionMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const metaDescription = descriptionMatch ? descriptionMatch[1] : '';

    // Combine and limit content
    const enhancedContent = `Title: ${title}\nMeta Description: ${metaDescription}\n\nContent: ${textContent}`.substring(0, 10000);

    console.log('Enhanced content length:', enhancedContent.length);

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Enhanced OpenAI analysis
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert business analyst specializing in company analysis. Analyze the provided website content and extract detailed business intelligence.

IMPORTANT: Return your response as a valid JSON object with exactly these fields:
- companyOverview: Comprehensive description of what the company does, its size, experience, and unique value proposition
- missionVision: Company's mission, vision, values, and long-term goals extracted from their messaging
- productsServices: Detailed breakdown of their products/services, pricing models, and key offerings
- targetMarket: Primary customer segments, demographics, industries, and market positioning
- keyDifferentiators: Unique selling points, competitive advantages, and what sets them apart
- industryClassification: Primary industry/sector classification
- confidenceScores: Object with confidence level (0-1) for each extracted field

Ensure each field contains substantial, specific information extracted from the website content. If information is not available, indicate that clearly rather than making assumptions.`
          },
          {
            role: 'user',
            content: `Analyze this website and extract comprehensive business information:

Website URL: ${websiteUrl}

${enhancedContent}

Focus on extracting factual, specific information rather than generic descriptions. Look for concrete details about the business model, target customers, unique value propositions, and competitive positioning.`
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisContent = analysisData.choices[0].message.content;

    console.log('Raw OpenAI response:', analysisContent);

    // Parse and validate analysis
    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.log('Failed to parse as JSON, creating structured response');
      parsedAnalysis = {
        companyOverview: analysisContent.substring(0, 500) + '...',
        missionVision: 'Mission and vision information extracted from website analysis.',
        productsServices: 'Products and services information identified from website content.',
        targetMarket: 'Target market analysis based on website messaging and content.',
        keyDifferentiators: 'Key differentiators and competitive advantages identified.',
        industryClassification: 'Industry classification based on website content.',
        confidenceScores: { overall: 0.5 }
      };
    }

    // Ensure all required fields exist with proper field names
    const analysis = {
      companyOverview: parsedAnalysis.companyOverview || 'Company overview extracted from website analysis.',
      missionVision: parsedAnalysis.missionVision || 'Mission and vision information identified from website content.',
      productsServices: parsedAnalysis.productsServices || parsedAnalysis.products || 'Products and services information extracted from website.',
      targetMarket: parsedAnalysis.targetMarket || 'Target market analysis based on website content.',
      keyDifferentiators: parsedAnalysis.keyDifferentiators || 'Key differentiators identified from website analysis.',
      industryClassification: parsedAnalysis.industryClassification || 'Industry classification based on analysis.',
      confidenceScores: parsedAnalysis.confidenceScores || { overall: 0.7 }
    };

    console.log('Analysis extracted successfully:', Object.keys(analysis));

    // Save to database
    const { data: knowledgeBase, error: dbError } = await supabase
      .from('company_knowledge_base')
      .upsert({
        company_id: companyId,
        source_url: websiteUrl,
        company_overview: analysis.companyOverview,
        mission_vision: analysis.missionVision,
        products_services: analysis.productsServices,
        target_market: analysis.targetMarket,
        key_differentiators: analysis.keyDifferentiators,
        industry_classification: analysis.industryClassification,
        confidence_scores: analysis.confidenceScores,
        metadata: {
          analysis_timestamp: new Date().toISOString(),
          content_length: enhancedContent.length,
          title: title,
          meta_description: metaDescription
        }
      }, {
        onConflict: 'company_id,source_url'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue without failing - return analysis even if DB save fails
    } else {
      console.log('Knowledge base saved successfully:', knowledgeBase?.id);
    }

    // Create/update playbook sections with analysis data
    const playbookSections = [
      {
        title: 'Mission & Vision',
        content: analysis.missionVision,
        tags: ['sales', 'support', 'hr'],
        section_order: 1
      },
      {
        title: 'Value Proposition', 
        content: `## Company Overview\n${analysis.companyOverview}\n\n## Key Differentiators\n${analysis.keyDifferentiators}\n\n## Products & Services\n${analysis.productsServices}`,
        tags: ['sales', 'marketing'],
        section_order: 2
      },
      {
        title: 'Customer Segments',
        content: analysis.targetMarket,
        tags: ['sales', 'marketing', 'support'],
        section_order: 3
      }
    ];

    const updatedSections: string[] = [];
    
    // Upsert each section
    for (const section of playbookSections) {
      const { error: sectionError } = await supabase
        .from('playbook_sections')
        .upsert({
          company_id: companyId,
          title: section.title,
          content: section.content,
          section_order: section.section_order,
          status: 'in_progress',
          progress_percentage: 50,
          tags: section.tags,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id,title'
        });
        
      if (sectionError) {
        console.error(`Error upserting ${section.title}:`, sectionError);
      } else {
        console.log(`Successfully updated playbook section: ${section.title}`);
        updatedSections.push(section.title);
      }
    }

    return new Response(
      JSON.stringify({ 
        analysis,
        knowledgeBaseId: knowledgeBase?.id,
        playbookSectionsUpdated: updatedSections,
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          contentLength: enhancedContent.length,
          confidenceScore: analysis.confidenceScores.overall || 0.7
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in analyze-website function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});