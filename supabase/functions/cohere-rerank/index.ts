import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RerankRequest {
  model: string;
  query: string;
  documents: string[];
  top_n?: number;
  return_documents?: boolean;
}

interface RerankResult {
  index: number;
  relevance_score: number;
  document?: string;
}

interface RerankResponse {
  results: RerankResult[];
  meta?: {
    api_version: {
      version: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      model = 'rerank-english-v3.0',
      query,
      documents,
      top_n,
      return_documents = false,
    }: RerankRequest = await req.json();

    // Validation
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid query parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid documents parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get Cohere API key from environment
    const cohereApiKey = Deno.env.get('COHERE_API_KEY');
    if (!cohereApiKey) {
      console.error('COHERE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Cohere API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Reranking ${documents.length} documents with model: ${model}`);
    console.log(`Query: ${query.substring(0, 100)}...`);
    if (top_n) {
      console.log(`Returning top ${top_n} results`);
    }

    // Call Cohere Rerank API
    const cohereResponse = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cohereApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n,
        return_documents,
      }),
    });

    if (!cohereResponse.ok) {
      const errorText = await cohereResponse.text();
      console.error('Cohere API error:', cohereResponse.status, errorText);

      let errorMessage = 'Cohere API error';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseError) {
        // Use raw error text
        errorMessage = errorText;
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to rerank documents',
          details: errorMessage,
          status: cohereResponse.status,
        }),
        {
          status: cohereResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result: RerankResponse = await cohereResponse.json();

    console.log(`Successfully reranked documents, returned ${result.results.length} results`);

    // Log top 3 results
    result.results.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i + 1}. Index ${r.index}, Score: ${r.relevance_score.toFixed(4)}`);
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in cohere-rerank function:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Failed to rerank documents',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
