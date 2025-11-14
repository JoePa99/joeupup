import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateFromTextRequest {
  companyId: string;
  extractedText?: string;
  additionalContext?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      companyId,
      extractedText,
      additionalContext = ''
    }: GenerateFromTextRequest = await req.json();

    if (!companyId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company ID is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🤖 [GENERATE-OS] Generating CompanyOS from text');
    console.log('🤖 [GENERATE-OS] Company ID:', companyId);

    // Create service role client for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get extracted text from database if not provided
    let textForAnalysis = extractedText;
    
    if (!textForAnalysis) {
      console.log('🤖 [GENERATE-OS] No text provided, fetching from database...');
      
      const { data: existingOS, error: fetchError } = await supabaseServiceClient
        .from('company_os')
        .select('raw_scraped_text, status')
        .eq('company_id', companyId)
        .single();

      if (fetchError || !existingOS) {
        throw new Error('No extracted text found. Please extract text first.');
      }

      if (existingOS.status !== 'draft') {
        console.warn('🤖 [GENERATE-OS] Warning: CompanyOS status is not "draft". Current status:', existingOS.status);
      }

      textForAnalysis = existingOS.raw_scraped_text;
      
      if (!textForAnalysis || textForAnalysis.length < 100) {
        throw new Error('Extracted text is too short or missing. Please extract text first.');
      }
      
      console.log('🤖 [GENERATE-OS] Fetched text from database, length:', textForAnalysis.length);
    }

    // Update status to 'generating'
    await supabaseServiceClient
      .from('company_os')
      .update({ status: 'generating' })
      .eq('company_id', companyId);

    // Prepare text for OpenAI analysis (chunk if too large)
    const maxAnalysisLength = 400000; // 400k characters for analysis
    const truncatedText = textForAnalysis.length > maxAnalysisLength 
      ? textForAnalysis.substring(0, maxAnalysisLength) + '\n\n[Note: Document truncated for analysis - full text available in raw_scraped_text]'
      : textForAnalysis;

    console.log('🤖 [GENERATE-OS] Text length for analysis:', truncatedText.length);

    // Build the prompt with extracted document content
    const systemPrompt = `Act as a Senior Strategic Analyst with a world-class consulting firm. Your expertise is in brand strategy, market analysis, and structuring knowledge bases for AI consumption. Your sole task is to analyze the provided company document and extract structured information as a single, complete JSON object.

CRITICAL EXTRACTION RULES:
- You MUST extract information EXACTLY as it appears in the document, word for word, line by line.
- Use DIRECT QUOTES from the document whenever possible. Preserve the exact wording, punctuation, and formatting.
- When you quote directly from the document, wrap the exact text in quotation marks.
- You MUST address every data point requested in the output schema below.
- When specific data is unavailable in the document (e.g., internal beliefs, specific KPIs, voice rules), you MUST make educated assumptions based on the document's content and industry best practices.
- For any value that is an assumption (not explicitly stated in the document), you MUST append the string " (Assumed)" to the end of the text. This is critical for data traceability.
- For any value that is a direct quote from the document, you MUST append the string " (Direct Quote)" to indicate it's verbatim from the source.
- All content must be specific, actionable, and ready for business use. Avoid vague or generic statements.
- Your ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT that conforms precisely to the schema provided. Do not include any conversational text, explanations, markdown formatting, or any characters before or after the opening and closing curly braces {} of the JSON object.`;

    const userPrompt = `Analyze the following company document and extract comprehensive company information. IMPORTANT: Extract information EXACTLY as it appears in the document. Use direct quotes whenever possible and preserve the exact wording, punctuation, and formatting from the source material.

DOCUMENT CONTENT:
${truncatedText}

${additionalContext ? `\nADDITIONAL CONTEXT:\n${additionalContext}\n` : ''}

Generate a comprehensive CompanyOS JSON object using this exact schema:

{
  "coreIdentityAndStrategicFoundation": {
    "companyOverview": "A brief, high-level summary of the company, its main offerings, and market position.",
    "missionAndVision": {
      "missionStatement": "The company's current official or derived mission statement.",
      "visionStatement": "The company's long-term, aspirational vision statement."
    },
    "coreValues": [
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "coreCompetencies": [
      "Competency 1",
      "Competency 2",
      "Competency 3"
    ],
    "positioningStatement": {
      "targetSegment": "For [specific target audience description]...",
      "category": "who [statement of need or opportunity], [Company Name] is a [market category]...",
      "uniqueBenefit": "that [statement of key benefit].",
      "reasonToBelieve": "Unlike [primary competitive alternative], our product [statement of primary differentiation]."
    },
    "businessModel": {
      "revenueModel": "How the company makes money (e.g., SaaS subscription, direct sales, advertising).",
      "pricingStrategy": "Description of their pricing approach (e.g., Tiered, Per-Seat, Value-Based).",
      "distributionChannels": [
        "Channel 1 (e.g., Direct Sales)",
        "Channel 2 (e.g., Online)"
      ]
    },
    "keyPerformanceIndicators": [
      "KPI 1 (e.g., Customer Lifetime Value - CLV)",
      "KPI 2 (e.g., Customer Acquisition Cost - CAC)",
      "KPI 3 (e.g., Monthly Recurring Revenue - MRR)"
    ],
    "rightToWin": "The single, unique, and defensible advantage the company has over its competition.",
    "swotAnalysis": {
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
      "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
      "threats": ["Threat 1", "Threat 2", "Threat 3"]
    }
  },
  "customerAndMarketContext": {
    "idealCustomerProfile": {
      "definingTraits": "Key firmographic/psychographic traits.",
      "keyDemographics": "Demographics of the key buyer/user.",
      "representativePersona": "A brief, narrative persona."
    },
    "customerSegments": [
      {
        "segment": "Segment Name 1",
        "description": "A one-sentence description of this customer group."
      }
    ],
    "customerJourney": {
      "topPainPoints": [
        "Primary customer pain point the product solves.",
        "Secondary pain point.",
        "Tertiary pain point."
      ],
      "topImprovementOpportunities": [
        "Opportunity 1 to improve the customer experience or journey.",
        "Opportunity 2 to improve the customer experience or journey."
      ]
    },
    "marketAnalysis": {
      "primaryCategoryAnalysis": "Analysis of the company's primary market category, including estimated size and key trends.",
      "topDirectCompetitors": [
        "Competitor 1",
        "Competitor 2",
        "Competitor 3"
      ]
    },
    "valuePropositions": [
      {
        "clientType": "Target Segment 1",
        "value": "The unique value delivered to this specific client type."
      }
    ]
  },
  "brandVoiceAndExpression": {
    "brandPurpose": "The 'why' behind the company, beyond making money.",
    "theHotTake": "The company's spicy, controversial, or strong point of view on its industry.",
    "powerfulBeliefs": [
      "We believe [Provocative Belief 1, written as a headline].",
      "We believe [Provocative Belief 2, written as a headline].",
      "We believe [Provocative Belief 3, written as a headline]."
    ],
    "transformation": {
      "from": "The negative state customers are in before the product.",
      "to": "The positive state customers are in after the product."
    },
    "brandVoiceDosAndDonts": {
      "dos": [
        "Be [Adjective 1, e.g., Confident]",
        "Use [Language type, e.g., Simple, direct language]",
        "Always [Action, e.g., Focus on the customer's success]"
      ],
      "donts": [
        "Never be [Adjective 2, e.g., Arrogant]",
        "Avoid [Language type, e.g., Technical jargon]",
        "Don't [Action, e.g., Make unrealistic promises]"
      ]
    },
    "celebrityAnalogue": "The single celebrity (or public figure) who best embodies the company's tone of voice and attitude.",
    "contentStrategy": {
      "pillars": [
        "Pillar 1: A core theme or topic for content creation.",
        "Pillar 2: A core theme or topic for content creation."
      ],
      "keyStrategicImperatives": [
        "Strategic goal for the upcoming year.",
        "Second strategic goal for the upcoming year."
      ]
    }
  }
}

Remember to append " (Assumed)" to any values that are assumptions based on the document content rather than explicit facts found in the document.`;

    // Call OpenAI API
    console.log('🤖 [GENERATE-OS] Calling OpenAI to analyze document...');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error('🤖 [GENERATE-OS] OpenAI API error:', errorData);
      
      // Update status to 'failed'
      await supabaseServiceClient
        .from('company_os')
        .update({ status: 'failed' })
        .eq('company_id', companyId);
      
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('🤖 [GENERATE-OS] Received response from OpenAI');
    
    let companyOSContent = openaiData.choices[0].message.content as string;
    
    // Sanitize: strip code fences like ```json ... ``` if present
    if (typeof companyOSContent === 'string') {
      const fenceMatch = companyOSContent.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
      if (fenceMatch && fenceMatch[1]) {
        companyOSContent = fenceMatch[1].trim();
      }
      companyOSContent = companyOSContent.trim();
    }

    // Parse the JSON response
    let companyOSData;
    try {
      companyOSData = JSON.parse(companyOSContent);
    } catch (parseError) {
      console.error('🤖 [GENERATE-OS] Failed to parse response as JSON:', parseError);
      console.error('🤖 [GENERATE-OS] Raw content:', companyOSContent.substring(0, 500));
      
      // Update status to 'failed'
      await supabaseServiceClient
        .from('company_os')
        .update({ status: 'failed' })
        .eq('company_id', companyId);
      
      throw new Error('Failed to parse CompanyOS response. Please try again.');
    }

    // Validate that we have the required top-level keys
    const requiredKeys = ['coreIdentityAndStrategicFoundation', 'customerAndMarketContext', 'brandVoiceAndExpression'];
    const missingKeys = requiredKeys.filter(key => !companyOSData[key]);
    
    if (missingKeys.length > 0) {
      console.error('🤖 [GENERATE-OS] Missing required keys:', missingKeys);
      
      // Update status to 'failed'
      await supabaseServiceClient
        .from('company_os')
        .update({ status: 'failed' })
        .eq('company_id', companyId);
      
      throw new Error(`Generated CompanyOS is missing required sections: ${missingKeys.join(', ')}`);
    }

    // Store in database
    const { data: existingOS } = await supabaseServiceClient
      .from('company_os')
      .select('id, version, metadata')
      .eq('company_id', companyId)
      .single();

    let result;
    if (existingOS) {
      // Update existing CompanyOS
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .update({
          os_data: companyOSData,
          version: (existingOS.version || 0) + 1,
          last_updated: new Date().toISOString(),
          generated_by: user.id,
          status: 'completed',
          metadata: {
            ...existingOS.metadata,
            generation_completed_at: new Date().toISOString(),
            additionalContext,
            model: 'openai/gpt-4o'
          }
        })
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) {
        console.error('🤖 [GENERATE-OS] Database update error:', error);
        throw error;
      }
      
      result = data;
      console.log('🤖 [GENERATE-OS] Updated existing CompanyOS, new version:', result.version);
    } else {
      // This shouldn't happen if text extraction was done first, but handle it anyway
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .insert({
          company_id: companyId,
          os_data: companyOSData,
          raw_scraped_text: textForAnalysis,
          version: 1,
          generated_by: user.id,
          status: 'completed',
          metadata: {
            source_type: 'document_upload',
            generation_completed_at: new Date().toISOString(),
            additionalContext,
            model: 'openai/gpt-4o'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('🤖 [GENERATE-OS] Database insert error:', error);
        throw error;
      }
      
      result = data;
      console.log('🤖 [GENERATE-OS] Created new CompanyOS');
    }

    const executionTime = Date.now() - startTime;

    console.log('🤖 [GENERATE-OS] Generation completed successfully');
    console.log(`🤖 [GENERATE-OS] Execution time: ${executionTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      companyOS: result,
      metadata: {
        sourceType: 'document_upload',
        generated_at: new Date().toISOString(),
        execution_time: executionTime,
        model: 'openai/gpt-4o'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🤖 [GENERATE-OS] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});




