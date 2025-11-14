import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { action, assistant_id, name, instructions, model = 'gpt-4o-mini', ...otherParams } = await req.json();

    console.log('OpenAI Assistant action:', action, { assistant_id, name, model });

    switch (action) {
      case 'create':
        return await createAssistant(name, instructions, model, otherParams);
      
      case 'update':
        return await updateAssistant(assistant_id, { name, instructions, model, ...otherParams });
      
      case 'delete':
        return await deleteAssistant(assistant_id);
      
      case 'get':
        return await getAssistant(assistant_id);
      
      case 'list':
        return await listAssistants();
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in manage-openai-assistants function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorStack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createAssistant(name: string, instructions: string, model: string, otherParams: any) {
  console.log('Creating OpenAI assistant:', { name, model });

  // First create a vector store
  const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      name: `${name} Knowledge Base`,
      metadata: { agent_name: name }
    }),
  });

  if (!vectorStoreResponse.ok) {
    const error = await vectorStoreResponse.text();
    console.error('Failed to create vector store:', error);
    throw new Error('Failed to create vector store');
  }

  const vectorStore = await vectorStoreResponse.json();
  console.log('Vector store created:', vectorStore.id);

  // Create the assistant
  const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      name,
      instructions,
      model,
      tools: [
        { type: "file_search" },
        { type: "code_interpreter" }
      ],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id]
        }
      },
      metadata: { 
        created_by: 'agent-manager',
        vector_store_id: vectorStore.id
      }
    }),
  });

  if (!assistantResponse.ok) {
    const error = await assistantResponse.text();
    console.error('Failed to create assistant:', error);
    
    // Clean up vector store if assistant creation failed
    await fetch(`https://api.openai.com/v1/vector_stores/${vectorStore.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
    });

    throw new Error('Failed to create assistant');
  }

  const assistant = await assistantResponse.json();
  console.log('Assistant created successfully:', assistant.id);

  return new Response(JSON.stringify({ 
    assistant_id: assistant.id,
    vector_store_id: vectorStore.id,
    assistant: assistant,
    vector_store: vectorStore
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateAssistant(assistantId: string, updates: any) {
  console.log('Updating OpenAI assistant:', assistantId);

  const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to update assistant:', error);
    throw new Error('Failed to update assistant');
  }

  const assistant = await response.json();
  console.log('Assistant updated successfully:', assistantId);

  return new Response(JSON.stringify({ assistant }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function deleteAssistant(assistantId: string) {
  console.log('Deleting OpenAI assistant:', assistantId);

  // First get the assistant to find the vector store
  const getResponse = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
  });

  if (getResponse.ok) {
    const assistant = await getResponse.json();
    const vectorStoreId = assistant.metadata?.vector_store_id;

    // Delete the vector store if it exists
    if (vectorStoreId) {
      try {
        await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          },
        });
        console.log('Vector store deleted:', vectorStoreId);
      } catch (error) {
        console.warn('Failed to delete vector store:', error);
      }
    }
  }

  // Delete the assistant
  const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to delete assistant:', error);
    throw new Error('Failed to delete assistant');
  }

  const result = await response.json();
  console.log('Assistant deleted successfully:', assistantId);

  return new Response(JSON.stringify({ result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAssistant(assistantId: string) {
  const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to get assistant:', error);
    throw new Error('Failed to get assistant');
  }

  const assistant = await response.json();

  return new Response(JSON.stringify({ assistant }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function listAssistants() {
  const response = await fetch('https://api.openai.com/v1/assistants', {
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to list assistants:', error);
    throw new Error('Failed to list assistants');
  }

  const assistants = await response.json();

  return new Response(JSON.stringify({ assistants }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}