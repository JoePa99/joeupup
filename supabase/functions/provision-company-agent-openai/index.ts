import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProvisionAgentRequest {
  agent_id: string;
  company_id: string;
  agent_name: string;
  agent_description?: string;
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
    const body: ProvisionAgentRequest = await req.json();
    
    console.log('Provisioning OpenAI resources for company agent:', body);

    const { agent_id, company_id, agent_name, agent_description } = body;

    if (!agent_id || !company_id || !agent_name) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All fields are required: agent_id, company_id, agent_name' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Verify agent exists and belongs to company
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, description, company_id')
      .eq('id', agent_id)
      .eq('company_id', company_id)
      .single();

    if (agentError || !agent) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent not found or access denied' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Get company name for vector store naming
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Company not found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    console.log(`Provisioning OpenAI resources for agent: ${agent_name} at company: ${company.name}`);

    // STEP 1: Create OpenAI Vector Store
    console.log('Step 1: Creating OpenAI vector store...');
    
    const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: `${agent_name} - ${company.name}`,
        description: `Vector store for ${agent_name} at ${company.name}`,
      }),
    });

    if (!vectorStoreResponse.ok) {
      const errorText = await vectorStoreResponse.text();
      console.error('Vector store creation failed:', errorText);
      throw new Error(`Failed to create vector store: ${errorText}`);
    }

    const vectorStore = await vectorStoreResponse.json();
    console.log('Created vector store:', vectorStore.id);

    // STEP 2: Create OpenAI Assistant
    console.log('Step 2: Creating OpenAI assistant...');
    
    const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: `${agent_name} - ${company.name}`,
        description: agent_description || agent.description || `AI assistant for ${agent_name} at ${company.name}`,
        model: 'gpt-4o',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStore.id]
          }
        },
        instructions: `You are a ${agent_name} assistant for ${company.name}. Help users with tasks related to ${agent_description || agent.description || 'your specialized domain'}.`
      }),
    });

    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      console.error('Assistant creation failed:', errorText);
      throw new Error(`Failed to create assistant: ${errorText}`);
    }

    const assistant = await assistantResponse.json();
    console.log('Created assistant:', assistant.id);

    // STEP 3: Update agent record with OpenAI IDs
    console.log('Step 3: Updating agent record...');
    
    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        assistant_id: assistant.id,
        vector_store_id: vectorStore.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', agent_id);

    if (updateError) {
      console.error('Error updating agent:', updateError);
      throw new Error('Failed to update agent with OpenAI configuration');
    }

    console.log('Successfully provisioned OpenAI resources for agent:', agent_name);

    return new Response(JSON.stringify({
      success: true,
      message: `OpenAI resources provisioned for ${agent_name} at ${company.name}`,
      data: {
        agent_id: agent_id,
        assistant_id: assistant.id,
        vector_store_id: vectorStore.id,
        agent_name: agent_name,
        company_name: company.name
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error provisioning OpenAI resources:', error);
    
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
