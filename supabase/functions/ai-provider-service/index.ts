import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: string;
  content: string;
}

interface AIRequest {
  provider: "openai" | "anthropic" | "google";
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  web_access?: boolean;
  functions?: any[];
}

async function callOpenAI(request: AIRequest) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const body: any = {
    model: request.model,
    messages: request.messages,
  };

  // Add max_completion_tokens for newer models
  if (request.model.startsWith('gpt-5') || request.model.startsWith('o3') || request.model.startsWith('o4')) {
    if (request.max_tokens) body.max_completion_tokens = request.max_tokens;
  } else {
    if (request.max_tokens) body.max_tokens = request.max_tokens;
    // gpt-4o-search-preview doesn't support temperature parameter
    if (request.temperature !== undefined && request.model !== 'gpt-4o-search-preview') {
      body.temperature = request.temperature;
    }
  }

  // Add web search for compatible models
  if (request.web_access && request.model === 'gpt-4o-search-preview') {
    body.web_search_options = {};
  }

  if (request.functions) {
    body.tools = request.functions;
    body.tool_choice = "auto";
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return await response.json();
}

async function callAnthropic(request: AIRequest) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Anthropic API key not configured');

  // Convert messages format (extract system message)
  const systemMessage = request.messages.find(m => m.role === 'system');
  const conversationMessages = request.messages.filter(m => m.role !== 'system');

  const body: any = {
    model: request.model,
    messages: conversationMessages,
    max_tokens: request.max_tokens || 2000,
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (request.functions) {
    body.tools = request.functions.map((fn: any) => ({
      name: fn.function.name,
      description: fn.function.description,
      input_schema: fn.function.parameters,
    }));
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Anthropic API error:', errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Convert Anthropic response to OpenAI format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.content[0].text,
        tool_calls: data.content
          .filter((c: any) => c.type === 'tool_use')
          .map((c: any) => ({
            id: c.id,
            type: 'function',
            function: {
              name: c.name,
              arguments: JSON.stringify(c.input),
            },
          })),
      },
      finish_reason: data.stop_reason,
    }],
    usage: data.usage,
  };
}

async function callGoogle(request: AIRequest) {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('Google AI API key not configured');

  // Convert messages to Google format
  const contents = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Add system instruction separately
  const systemMessage = request.messages.find(m => m.role === 'system');

  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens || 2000,
      temperature: request.temperature ?? 0.7,
    },
  };

  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  if (request.functions) {
    body.tools = [{
      functionDeclarations: request.functions.map((fn: any) => ({
        name: fn.function.name,
        description: fn.function.description,
        parameters: fn.function.parameters,
      })),
    }];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google AI API error:', errorText);
    throw new Error(`Google AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Convert Google response to OpenAI format
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('No response from Google AI');
  }

  return {
    choices: [{
      message: {
        role: 'assistant',
        content: candidate.content.parts[0]?.text || '',
        tool_calls: candidate.content.parts
          .filter((p: any) => p.functionCall)
          .map((p: any) => ({
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args),
            },
          })),
      },
      finish_reason: candidate.finishReason,
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: AIRequest = await req.json();
    
    console.log(`AI Provider Service: ${request.provider} - ${request.model}`);

    let response;
    switch (request.provider) {
      case 'openai':
        response = await callOpenAI(request);
        break;
      case 'anthropic':
        response = await callAnthropic(request);
        break;
      case 'google':
        response = await callGoogle(request);
        break;
      default:
        throw new Error(`Unsupported provider: ${request.provider}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Provider Service error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
