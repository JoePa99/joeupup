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

    const { user_id } = body;

    // company_id is no longer required as agents are now global

    if (!user_id || user_id === '' || user_id === 'undefined') {
      console.log('Invalid user_id provided:', user_id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Valid User ID is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Creating global OpenAI assistants');

    // Check for existing global agents
    const { data: existingAgents, error: existingAgentsError } = await supabase
      .from('agents')
      .select('id, name, agent_type_id, assistant_id, vector_store_id')
      .eq('status', 'active');

    if (existingAgentsError) {
      throw existingAgentsError;
    }

    // If agents already exist, return them without creating duplicates
    if (existingAgents && existingAgents.length > 0) {
      console.log(`Found ${existingAgents.length} existing global agents, skipping creation`);
      
      // Get user's company_id for conversation
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user_id)
        .single();
      
      // Ensure conversations exist for the user with existing agents using upsert
      for (const agent of existingAgents) {
        try {
          const { data: conversation, error: conversationError } = await supabase
            .from('chat_conversations')
            .upsert({
              agent_id: agent.id,
              user_id: user_id,
              company_id: userProfile?.company_id,
              title: `Chat with ${agent.name}`
            }, {
              onConflict: 'user_id,agent_id,company_id'
            })
            .select()
            .single();

          if (conversationError) {
            // Handle unique constraint violation by fetching existing conversation
            if (conversationError.code === '23505') {
              console.log('Conversation already exists for existing agent:', agent.name);
            } else {
              console.error('Conversation creation error:', conversationError);
              console.log('Warning: Failed to create conversation for existing agent:', agent.name);
            }
          } else {
            console.log('Created/retrieved conversation:', conversation.id, 'for existing agent:', agent.name);
          }
        } catch (error) {
          console.error('Unexpected error in conversation creation for existing agent:', error);
          console.log('Warning: Failed to create conversation for existing agent:', agent.name);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        agents: existingAgents,
        message: `Found ${existingAgents.length} existing agents, no duplicates created`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get default agent types
    const { data: agentTypes, error: agentTypesError } = await supabase
      .from('agent_types')
      .select('*');

    if (agentTypesError) {
      throw agentTypesError;
    }

    const createdAgents = [];

    // Get user's company_id for conversation creation
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user_id)
      .single();

    // Create agents and OpenAI assistants for each type
    for (const agentType of agentTypes) {
      console.log('Creating OpenAI assistant for:', agentType.name);
      
      // Create vector store for the assistant
      const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          name: `${agentType.name} - Global`,
        }),
      });

      if (!vectorStoreResponse.ok) {
        const errorText = await vectorStoreResponse.text();
        console.error('Vector store creation failed:', errorText);
        throw new Error(`Failed to create vector store: ${errorText}`);
      }

      const vectorStore = await vectorStoreResponse.json();
      console.log('Created vector store:', vectorStore.id);

      // Create OpenAI Assistant
      const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          name: agentType.name,
          description: agentType.description,
          model: 'gpt-4o',
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStore.id]
            }
          },
          instructions: `You are a ${agentType.name} assistant. Help users with tasks related to ${agentType.description}.`
        }),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        console.error('Assistant creation failed:', errorText);
        throw new Error(`Failed to create assistant: ${errorText}`);
      }

      const assistant = await assistantResponse.json();
      console.log('Created assistant:', assistant.id);

      // Create global agent in database
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
          name: agentType.name,
          description: agentType.description,
          role: agentType.name.toLowerCase().replace(/\s+/g, '_'),
          avatar_url: agentType.default_avatar_url,
          company_id: null, // Global agent
          agent_type_id: agentType.id,
          assistant_id: assistant.id,
          vector_store_id: vectorStore.id,
          status: 'active',
          configuration: {
            model: 'gpt-4o',
            temperature: 0.7,
            max_tokens: 1000
          }
        })
        .select()
        .single();

      if (agentError) {
        console.error('Agent creation error:', agentError);
        throw agentError;
      }

      // Create or get conversation for this agent with the user using upsert
      try {
        const { data: conversation, error: conversationError } = await supabase
          .from('chat_conversations')
          .upsert({
            agent_id: agent.id,
            user_id: user_id,
            company_id: userProfile?.company_id,
            title: `Chat with ${agent.name}`
          }, {
            onConflict: 'user_id,agent_id,company_id'
          })
          .select()
          .single();

        if (conversationError) {
          // Handle unique constraint violation by fetching existing conversation
          if (conversationError.code === '23505') {
            console.log('Conversation already exists for user and agent:', agent.name);
          } else {
            console.error('Conversation creation error:', conversationError);
            console.log('Warning: Failed to create conversation for agent:', agent.name);
          }
        } else {
          console.log('Created/retrieved conversation:', conversation.id, 'for agent:', agent.name);
        }
      } catch (error) {
        console.error('Unexpected error in conversation creation:', error);
        console.log('Warning: Failed to create conversation for agent:', agent.name);
      }

      createdAgents.push(agent);
      console.log('Created agent:', agent.name, 'with assistant ID:', assistant.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      agents: createdAgents,
      message: `Created ${createdAgents.length} agents with OpenAI assistants`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-openai-assistants function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});