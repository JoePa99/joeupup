import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateCompanyOSRequest {
  companyName: string;
  industry?: string;
  specificContext?: string;
  websiteUrl?: string;
  companyId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
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
      companyName,
      industry = '',
      specificContext = '',
      websiteUrl = '',
      companyId
    }: GenerateCompanyOSRequest = await req.json();

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company name is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!companyId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company ID is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🏢 [COMPANY-OS] Generating CompanyOS for:', companyName);
    console.log('🏢 [COMPANY-OS] Industry:', industry || 'Not specified');
    console.log('🏢 [COMPANY-OS] Website:', websiteUrl || 'Not provided');

    // Build the research prompt with the exact specification
    const systemPrompt = `Act as a Senior Strategic Analyst with a world-class consulting firm. Your expertise is in brand strategy, market analysis, and structuring knowledge bases for AI consumption. Your sole task is to conduct deep, structured research on the provided company and output the findings as a single, complete JSON object.

EXECUTION RULES:
- You MUST use web search to ground your findings in real, current company data from official sources, reputable news outlets, and market analysis reports.
- You MUST address every data point requested in the output schema below.
- When specific data is unavailable (e.g., internal beliefs, specific KPIs, voice rules), you MUST make educated, research-based assumptions using industry best practices and comparable companies.
- For any value that is an assumption, you MUST append the string " (Assumed)" to the end of the text. This is critical for data traceability.
- All content must be concise, specific, actionable, and ready for business use. Avoid vague or generic statements.
- Your ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT that conforms precisely to the schema provided. Do not include any conversational text, explanations, markdown formatting, or any characters before or after the opening and closing curly braces {} of the JSON object.`;

    const userPrompt = `Company Name: ${companyName}
Industry/Sector: ${industry || 'To be researched'}
${websiteUrl ? `Website URL: ${websiteUrl}` : ''}
${specificContext ? `Specific Context: ${specificContext}` : ''}

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

Remember to append " (Assumed)" to any values that are assumptions based on research rather than explicit facts found.`;

    // Call Perplexity API with sonar-pro model
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
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
        temperature: 0.3, // Lower temperature for more factual, consistent output
      }),
    });

    if (!perplexityResponse.ok) {
      const errorData = await perplexityResponse.json().catch(() => ({}));
      console.error('🏢 [COMPANY-OS] Perplexity API error:', errorData);
      throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const perplexityData = await perplexityResponse.json();
    console.log('🏢 [COMPANY-OS] Received response from Perplexity');
    
    let companyOSContent = perplexityData.choices[0].message.content as string;
    
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
      console.error('🏢 [COMPANY-OS] Failed to parse response as JSON:', parseError);
      console.error('🏢 [COMPANY-OS] Raw content:', companyOSContent.substring(0, 500));
      throw new Error('Failed to parse CompanyOS response. Please try again.');
    }

    // Validate that we have the required top-level keys
    const requiredKeys = ['coreIdentityAndStrategicFoundation', 'customerAndMarketContext', 'brandVoiceAndExpression'];
    const missingKeys = requiredKeys.filter(key => !companyOSData[key]);
    
    if (missingKeys.length > 0) {
      console.error('🏢 [COMPANY-OS] Missing required keys:', missingKeys);
      throw new Error(`Generated CompanyOS is missing required sections: ${missingKeys.join(', ')}`);
    }

    // Store in database using service role
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if CompanyOS already exists for this company
    const { data: existingOS } = await supabaseServiceClient
      .from('company_os')
      .select('id, version')
      .eq('company_id', companyId)
      .single();

    let result;
    if (existingOS) {
      // Update existing CompanyOS
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .update({
          os_data: companyOSData,
          version: (existingOS.version || 1) + 1,
          last_updated: new Date().toISOString(),
          generated_by: user.id,
          source_url: websiteUrl || null,
          metadata: {
            source_type: 'web_research',
            industry,
            specificContext,
            regenerated_at: new Date().toISOString()
          }
        })
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS] Updated existing CompanyOS, new version:', result.version);
    } else {
      // Insert new CompanyOS
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .insert({
          company_id: companyId,
          os_data: companyOSData,
          version: 1,
          generated_by: user.id,
          source_url: websiteUrl || null,
          metadata: {
            source_type: 'web_research',
            industry,
            specificContext,
            generated_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS] Created new CompanyOS');
    }

    const executionTime = Date.now() - startTime;

    console.log('🏢 [COMPANY-OS] Generation completed successfully');
    console.log(`🏢 [COMPANY-OS] Execution time: ${executionTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      companyOS: result,
      metadata: {
        companyName,
        industry,
        websiteUrl,
        sourceType: 'web_research',
        generated_at: new Date().toISOString(),
        execution_time: executionTime,
        model: 'perplexity/sonar-pro'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🏢 [COMPANY-OS] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

