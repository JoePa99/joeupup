import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const body = await req.json();
    console.log('Request body:', body);

    const { document_id, agent_ids, file_content, file_name } = body;

    if (!document_id || !agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Document ID and agent IDs are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Uploading document to assistants for agents:', agent_ids);

    // First, upload file to OpenAI
    const formData = new FormData();
    const fileBlob = new Blob([file_content], { type: 'application/octet-stream' });
    formData.append('file', fileBlob, file_name);
    formData.append('purpose', 'assistants');

    const fileUploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!fileUploadResponse.ok) {
      const errorText = await fileUploadResponse.text();
      console.error('File upload failed:', errorText);
      throw new Error(`Failed to upload file to OpenAI: ${errorText}`);
    }

    const uploadedFile = await fileUploadResponse.json();
    console.log('File uploaded to OpenAI:', uploadedFile.id);

    const results = [];

    // Add file to each agent's vector store
    for (const agentId of agent_ids) {
      try {
        // Get agent details including vector_store_id
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('vector_store_id, assistant_id, name')
          .eq('id', agentId)
          .single();

        if (agentError || !agent) {
          console.error('Agent not found:', agentId);
          results.push({ 
            agent_id: agentId, 
            success: false, 
            error: 'Agent not found' 
          });
          continue;
        }

        if (!agent.vector_store_id) {
          console.error('Agent has no vector store:', agentId);
          results.push({ 
            agent_id: agentId, 
            success: false, 
            error: 'Agent has no vector store' 
          });
          continue;
        }

        // Add file to vector store
        const vectorStoreFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${agent.vector_store_id}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: uploadedFile.id
          }),
        });

        if (!vectorStoreFileResponse.ok) {
          const errorText = await vectorStoreFileResponse.text();
          console.error('Vector store file addition failed:', errorText);
          results.push({ 
            agent_id: agentId, 
            success: false, 
            error: `Failed to add file to vector store: ${errorText}` 
          });
          continue;
        }

        const vectorStoreFile = await vectorStoreFileResponse.json();
        console.log('File added to vector store:', vectorStoreFile.id);

        // Create agent_documents relationship
        const { error: relationError } = await supabase
          .from('agent_documents')
          .insert({
            agent_id: agentId,
            document_id: document_id
          });

        if (relationError) {
          console.error('Failed to create agent-document relationship:', relationError);
          results.push({ 
            agent_id: agentId, 
            success: false, 
            error: 'Failed to create document relationship' 
          });
          continue;
        }

        results.push({ 
          agent_id: agentId, 
          success: true,
          openai_file_id: uploadedFile.id,
          vector_store_file_id: vectorStoreFile.id
        });

        console.log('Successfully processed document for agent:', agent.name);

      } catch (agentError) {
        console.error('Error processing agent:', agentId, agentError);
        results.push({ 
          agent_id: agentId, 
          success: false, 
          error: agentError instanceof Error ? agentError.message : String(agentError) 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return new Response(JSON.stringify({ 
      success: successCount > 0, 
      results: results,
      openai_file_id: uploadedFile.id,
      message: `Successfully processed document for ${successCount}/${agent_ids.length} agents`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upload-documents-to-assistant function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});