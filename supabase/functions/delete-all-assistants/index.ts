import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAssistantRequest {
  company_id?: string; // Optional: if provided, only delete assistants for this company
  user_id: string;
}

interface Agent {
  id: string;
  name: string;
  assistant_id: string;
  company_id: string;
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
    const body: DeleteAssistantRequest = await req.json();
    
    console.log('Deleting all OpenAI assistants:', body);

    const { company_id, user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User ID is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Build query to get agents with assistant_id
    let query = supabase
      .from('agents')
      .select('id, name, assistant_id, company_id')
      .not('assistant_id', 'is', null);

    // If company_id is provided, filter by company
    if (company_id) {
      query = query.eq('company_id', company_id);
    }

    const { data: agents, error: agentsError } = await query;

    if (agentsError) {
      throw new Error(`Failed to fetch agents: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No agents with OpenAI assistants found',
        deleted_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${agents.length} agents with OpenAI assistants`);

    const results = {
      successful: [] as string[],
      failed: [] as { agent_id: string; name: string; error: string }[],
      total: agents.length
    };

    // Delete each OpenAI assistant
    for (const agent of agents) {
      try {
        console.log(`Deleting OpenAI assistant for agent: ${agent.name} (${agent.assistant_id})`);
        
        const response = await fetch(`https://api.openai.com/v1/assistants/${agent.assistant_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        if (response.ok) {
          console.log(`Successfully deleted OpenAI assistant: ${agent.assistant_id}`);
          results.successful.push(agent.assistant_id);
          
          // Update the agent record to remove assistant_id
          const { error: updateError } = await supabase
            .from('agents')
            .update({ 
              assistant_id: null,
              vector_store_id: null // Also clear vector_store_id if it exists
            })
            .eq('id', agent.id);

          if (updateError) {
            console.error(`Failed to update agent ${agent.id}:`, updateError);
          }
        } else {
          const errorText = await response.text();
          console.error(`Failed to delete OpenAI assistant ${agent.assistant_id}:`, response.status, errorText);
          results.failed.push({
            agent_id: agent.id,
            name: agent.name,
            error: `HTTP ${response.status}: ${errorText}`
          });
        }
      } catch (error) {
        console.error(`Error deleting OpenAI assistant for agent ${agent.name}:`, error);
        results.failed.push({
          agent_id: agent.id,
          name: agent.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log summary
    console.log(`Deletion complete. Successfully deleted: ${results.successful.length}, Failed: ${results.failed.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Deletion process completed`,
      results,
      summary: {
        total_agents: results.total,
        successfully_deleted: results.successful.length,
        failed_deletions: results.failed.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in delete-all-assistants function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
