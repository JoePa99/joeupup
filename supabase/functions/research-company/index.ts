import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { company_name, website, industry } = await req.json();

    if (!company_name) {
      throw new Error('Missing required field: company_name');
    }

    // Use GPT-4 to research the company and generate CompanyOS structure
    const prompt = `Research and create a comprehensive company profile for "${company_name}".
${website ? `Website: ${website}` : ''}
${industry ? `Industry: ${industry}` : ''}

Generate a structured company profile with the following sections:

1. Core Identity & Strategic Foundation
   - Mission statement
   - Vision statement
   - Core values (3-5 values)
   - Unique value proposition

2. Customer & Market Context
   - Primary target market
   - Customer pain points
   - Competitive advantages
   - Market positioning

3. Brand Voice & Expression
   - Brand personality traits
   - Tone of voice guidelines
   - Key messaging pillars
   - Communication style

Please provide detailed, professional content for each section based on available information about this company.
If information is not publicly available, generate reasonable professional content appropriate for a ${industry || 'professional'} company.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst expert at researching companies and creating comprehensive company profiles. Provide detailed, structured responses in JSON format.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    const openaiData = await openaiResponse.json();
    const companyProfile = openaiData.choices?.[0]?.message?.content;

    if (!companyProfile) {
      throw new Error('Failed to generate company profile');
    }

    const parsedProfile = JSON.parse(companyProfile);

    return new Response(
      JSON.stringify({
        company_os: {
          company_name,
          website,
          industry,
          ...parsedProfile,
          metadata: {
            generated_at: new Date().toISOString(),
            method: 'ai_research',
            confidence: 0.75
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in research-company:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
