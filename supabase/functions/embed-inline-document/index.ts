import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbeddings } from '../_shared/embedding-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbedInlineDocumentRequest {
  company_id: string;
  user_id: string;
  content: string;
  title?: string;
  section_tag?: string;
  description?: string;
  playbook_section_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: EmbedInlineDocumentRequest = await req.json();
    
    console.log('Embedding inline document:', { 
      company_id: body.company_id, 
      user_id: body.user_id,
      content_length: body.content?.length,
      title: body.title,
      section_tag: body.section_tag
    });

    const { company_id, user_id, content, title, section_tag, description, playbook_section_id } = body;

    if (!company_id || !user_id || !content) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Company ID, user ID, and content are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate content quality
    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Content must be at least 10 characters long' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Verify user has access to the company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user_id)
      .eq('company_id', company_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User not found or access denied to company' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    console.log('Generating embeddings for content length:', trimmedContent.length);

    // Create a document_archives record for visibility in the UI
    const documentTitle = title || 'Untitled Document';
    const timestamp = Date.now();
    const sanitizedTitle = documentTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    const filename = `playbook-${section_tag || 'general'}-${sanitizedTitle}-${timestamp}.md`;
    
    // Create a virtual storage path (not actually used for storage)
    const virtualStoragePath = `${user_id}/playbook/${filename}`;

    const { data: documentArchive, error: archiveError } = await supabase
      .from('document_archives')
      .insert({
        name: documentTitle,
        file_name: filename,
        file_type: 'text/markdown',
        file_size: trimmedContent.length,
        storage_path: virtualStoragePath,
        uploaded_by: user_id,
        company_id: company_id,
        doc_type: 'template',
        description: description || null,
        tags: ['playbook', section_tag || 'general', 'inline-embedded'],
        playbook_section_id: playbook_section_id || null,
        is_editable: true,
      })
      .select()
      .single();

    if (archiveError) {
      console.error('Error creating document archive:', archiveError);
      throw new Error('Failed to create document record');
    }

    console.log('Created document archive record:', documentArchive.id);

    // Generate embeddings for the content (handles chunking automatically)
    const embeddings = await generateEmbeddings(trimmedContent, OPENAI_API_KEY);
    
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings');
    }

    console.log(`Generated ${embeddings.length} embeddings, each with ${embeddings[0].length} dimensions`);

    // Store document content and embeddings in the Documents table
    // Store the first chunk
    const firstChunkContent = embeddings.length > 1 
      ? trimmedContent.substring(0, 1000) 
      : trimmedContent;

    if (firstChunkContent.trim().length >= 10) {
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          company_id: company_id,
          content: firstChunkContent,
          embedding: embeddings[0],
          agent_id: null, // Accessible by all agents in the company
          document_archive_id: documentArchive.id // Link to the document archive record
        });

      if (insertError) {
        console.error('Error inserting first document chunk:', insertError);
        throw new Error('Failed to store document content and embedding');
      }
    }

    // If there are multiple chunks, store additional chunks as separate documents
    if (embeddings.length > 1) {
      console.log(`Storing ${embeddings.length - 1} additional chunks`);
      
      for (let i = 1; i < embeddings.length; i++) {
        const startIndex = Math.max(0, i * 1000 - 50); // Account for overlap, ensure non-negative
        const endIndex = Math.min((i + 1) * 1000, trimmedContent.length);
        const chunkContent = trimmedContent.substring(startIndex, endIndex);
        
        // Skip empty or very short chunks
        if (chunkContent.trim().length < 10) {
          console.log(`Skipping chunk ${i} as it's too short (${chunkContent.trim().length} characters)`);
          continue;
        }
        
        const { error: chunkInsertError } = await supabase
          .from('documents')
          .insert({
            company_id: company_id,
            content: chunkContent,
            embedding: embeddings[i],
            agent_id: null,
            document_archive_id: documentArchive.id
          });

        if (chunkInsertError) {
          console.warn(`Warning: Failed to store chunk ${i}:`, chunkInsertError);
        }
      }
    }

    console.log('Inline document embedded successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Document embedded successfully',
      data: {
        document_archive_id: documentArchive.id,
        content_length: trimmedContent.length,
        embedding_dimensions: embeddings[0].length,
        total_chunks: embeddings.length,
        title: documentTitle,
        section_tag: section_tag || 'general'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error embedding inline document:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
