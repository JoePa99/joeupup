import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbeddings } from '../_shared/embedding-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexPlaybookEntryRequest {
  entry_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: IndexPlaybookEntryRequest = await req.json();

    if (!body.entry_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'entry_id is required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: entry, error: entryError } = await supabase
      .from('playbook_entries')
      .select('id, company_id, user_id, title, description, summary, content_markdown, content_html, status')
      .eq('id', body.entry_id)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Playbook entry not found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const rawContent = (entry.content_markdown || entry.content_html || '').trim();
    if (rawContent.length < 10) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Playbook entry content is too short to index'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const embeddings = await generateEmbeddings(rawContent, openaiKey);

    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings');
    }

    let storedChunks = 0;
    for (let i = 0; i < embeddings.length; i++) {
      const startIndex = Math.max(0, i * 1000 - 50);
      const endIndex = Math.min((i + 1) * 1000, rawContent.length);
      const chunkContent = rawContent.substring(startIndex, endIndex).trim();

      if (chunkContent.length < 10) {
        continue;
      }

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          company_id: entry.company_id,
          content: chunkContent,
          embedding: embeddings[i],
          agent_id: null,
          document_archive_id: null,
        });

      if (insertError) {
        console.error('Failed to insert playbook entry chunk:', insertError);
        throw new Error('Failed to store playbook entry chunk');
      }

      storedChunks += 1;
    }

    await supabase
      .from('playbook_entries')
      .update({
        last_indexed_at: new Date().toISOString(),
        indexed_chunks: storedChunks,
        is_published: true,
      })
      .eq('id', entry.id);

    return new Response(JSON.stringify({
      success: true,
      message: storedChunks > 1
        ? `Playbook entry indexed in ${storedChunks} chunks`
        : 'Playbook entry indexed successfully',
      data: {
        document_id: entry.id,
        content_length: rawContent.length,
        embedding_dimensions: embeddings[0].length,
        filename: entry.title || 'playbook-entry'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error indexing playbook entry:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to index playbook entry'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
