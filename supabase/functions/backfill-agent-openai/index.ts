import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  dry_run?: boolean;
  limit?: number;
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
    const body: BackfillRequest = await req.json() || {};
    
    const { dry_run = false, limit = 10 } = body;

    console.log(`Starting backfill for agents missing OpenAI configuration (dry_run: ${dry_run}, limit: ${limit})`);

    // Find all company agents missing OpenAI configuration
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select(`
        id, 
        name, 
        description, 
        company_id,
        companies(name)
      `)
      .not('company_id', 'is', null) // Only company agents
      .or('assistant_id.is.null,vector_store_id.is.null') // Missing either field
      .eq('status', 'active') // Only active agents
      .limit(limit);

    if (agentsError) {
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No agents found that need OpenAI configuration',
        data: {
          processed: 0,
          successful: 0,
          failed: 0,
          dry_run: dry_run
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${agents.length} agents that need OpenAI configuration`);

    const results = {
      processed: agents.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      dry_run: dry_run
    };

    // Process each agent
    for (const agent of agents) {
      try {
        console.log(`Processing agent: ${agent.name} (${agent.id})`);
        
        if (dry_run) {
          console.log(`[DRY RUN] Would provision OpenAI resources for: ${agent.name}`);
          results.successful++;
          continue;
        }

        // STEP 1: Create OpenAI Vector Store
        console.log('Creating OpenAI vector store...');
        
        const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({
            name: `${agent.name} - ${agent.companies.name}`,
            description: `Vector store for ${agent.name} at ${agent.companies.name}`,
          }),
        });

        if (!vectorStoreResponse.ok) {
          const errorText = await vectorStoreResponse.text();
          throw new Error(`Vector store creation failed: ${errorText}`);
        }

        const vectorStore = await vectorStoreResponse.json();
        console.log('Created vector store:', vectorStore.id);

        // STEP 2: Create OpenAI Assistant
        console.log('Creating OpenAI assistant...');
        
        const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({
            name: `${agent.name} - ${agent.companies.name}`,
            description: agent.description || `AI assistant for ${agent.name} at ${agent.companies.name}`,
            model: 'gpt-4o',
            tools: [{ type: 'file_search' }],
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id]
              }
            },
            instructions: `You are a ${agent.name} assistant for ${agent.companies.name}. Help users with tasks related to ${agent.description || 'your specialized domain'}.`
          }),
        });

        if (!assistantResponse.ok) {
          const errorText = await assistantResponse.text();
          throw new Error(`Assistant creation failed: ${errorText}`);
        }

        const assistant = await assistantResponse.json();
        console.log('Created assistant:', assistant.id);

        // STEP 3: Update agent record
        console.log('Updating agent record...');
        
        const { error: updateError } = await supabase
          .from('agents')
          .update({ 
            assistant_id: assistant.id,
            vector_store_id: vectorStore.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', agent.id);

        if (updateError) {
          throw new Error(`Failed to update agent: ${updateError.message}`);
        }

        console.log(`Successfully provisioned OpenAI resources for: ${agent.name}`);
        results.successful++;

      } catch (error: any) {
        console.error(`Failed to provision agent ${agent.name}:`, error);
        results.failed++;
        results.errors.push(`${agent.name} (${agent.id}): ${error.message}`);
      }
    }

    console.log('Backfill completed:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Backfill completed: ${results.successful} successful, ${results.failed} failed`,
      data: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error during backfill:', error);
    
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
