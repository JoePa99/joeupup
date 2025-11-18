import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate a single embedding for query text using OpenAI
 */
async function generateQueryEmbedding(
  query: string,
  apiKey: string
): Promise<number[]> {
  const model = 'text-embedding-3-large';
  const dimensions = 1536;

  try {
    const requestBody = {
      input: query,
      model,
      dimensions
    };

    console.log('Using OpenAI model:', model);
    console.log('Requesting dimensions:', dimensions);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.message) {
          console.error('OpenAI error details:', errorData.error);
          throw new Error(`OpenAI API error: ${response.status} - ${errorData.error.message}`);
        }
      } catch (parseError) {
        // If we can't parse the error, use the raw text
      }

      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      throw new Error('Invalid response from OpenAI API');
    }

    const embedding = result.data[0].embedding;
    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);

    // Verify we have the correct dimensions
    if (embedding.length !== dimensions) {
      console.warn(`Warning: Expected ${dimensions} dimensions for ${model}, but got ${embedding.length}`);
      console.warn('This might indicate the wrong model was used or there was an API issue');
    }

    return embedding;
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate embedding: ${errorMessage}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid text parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate embedding using shared utility
    console.log(`Generating embedding for text: ${text.substring(0, 100)}...`);
    const embedding = await generateQueryEmbedding(text, openaiApiKey);

    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);

    return new Response(
      JSON.stringify({ embedding }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-embedding function:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Failed to generate embedding',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
