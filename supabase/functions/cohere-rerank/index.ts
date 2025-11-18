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
    const { model, query, documents, top_n, return_documents } = await req.json();

    if (!query || !documents || !Array.isArray(documents)) {
      throw new Error('Missing required fields: query, documents');
    }

    const cohereApiKey = Deno.env.get('COHERE_API_KEY');

    // If no Cohere API key, return original order
    if (!cohereApiKey) {
      console.warn('No COHERE_API_KEY found, returning original document order');
      return new Response(
        JSON.stringify({
          results: documents.map((doc, index) => ({
            index,
            relevance_score: 1.0 - (index * 0.05), // Fake scores
            document: return_documents ? doc : undefined
          }))
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Call Cohere Rerank API
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cohereApiKey}`,
      },
      body: JSON.stringify({
        model: model || 'rerank-english-v3.0',
        query,
        documents: documents.map(doc => typeof doc === 'string' ? doc : doc.text || JSON.stringify(doc)),
        top_n: top_n || documents.length,
        return_documents: return_documents !== false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cohere rerank error:', data);
      // Fallback to original order on error
      return new Response(
        JSON.stringify({
          results: documents.map((doc, index) => ({
            index,
            relevance_score: 1.0 - (index * 0.05),
            document: return_documents ? doc : undefined
          }))
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ results: data.results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in cohere-rerank:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
