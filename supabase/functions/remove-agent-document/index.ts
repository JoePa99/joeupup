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
    console.log('Removing document from agent:', body);

    const { agent_id, document_id, user_id } = body;

    if (!agent_id || !document_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent ID and Document ID are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Verify the agent-document relationship exists
    const { data: agentDocument, error: agentDocError } = await supabase
      .from('agent_documents')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('document_id', document_id)
      .single();

    if (agentDocError || !agentDocument) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent-document relationship not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Get agent details including vector_store_id
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vector_store_id, name')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    console.log('Note: OpenAI vector store cleanup skipped - file IDs not tracked in agent_documents table');

    // Remove the agent-document relationship from database
    const { error: deleteError } = await supabase
      .from('agent_documents')
      .delete()
      .eq('agent_id', agent_id)
      .eq('document_id', document_id);

    if (deleteError) {
      throw new Error(`Failed to remove document relationship: ${deleteError.message}`);
    }

    console.log('Successfully removed agent-document relationship');

    return new Response(JSON.stringify({ 
      success: true,
      message: `Document removed from ${agent.name}`,
      note: 'OpenAI cleanup skipped - file IDs not tracked in database'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in remove-agent-document function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
