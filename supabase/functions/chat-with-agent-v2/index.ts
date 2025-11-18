import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  agent_id: string;
  conversation_id?: string;
  user_id: string;
  company_id?: string;
  attachments?: any[];
  client_message_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { message, agent_id, conversation_id, user_id, company_id, attachments, client_message_id } = await req.json() as ChatRequest;

    if (!message || !agent_id || !user_id) {
      throw new Error('Missing required fields: message, agent_id, user_id');
    }

    // 1. Fetch agent and context configuration
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .select('*, context_injection_config(*)')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    // 2. Generate embedding for the query
    const { data: embeddingData, error: embeddingError } = await supabaseClient.functions.invoke('generate-embedding', {
      body: { text: message }
    });

    if (embeddingError) {
      console.error('Error generating embedding:', embeddingError);
    }

    const queryEmbedding = embeddingData?.embedding || [];

    // 3. Retrieve context from multiple sources
    const contextSources = [];
    const contextConfig = agent.context_injection_config || {};
    const retrievalParams = contextConfig.retrieval_params || {};

    // CompanyOS Context
    if (retrievalParams.enable_company_os && company_id) {
      const { data: companyOS } = await supabaseClient
        .from('company_knowledge')
        .select('data')
        .eq('company_id', company_id)
        .single();

      if (companyOS?.data) {
        contextSources.push({
          tier: 'companyOS',
          content: JSON.stringify(companyOS.data).substring(0, 2000),
          metadata: { source: 'CompanyOS' }
        });
      }
    }

    // Agent-specific documents
    if (retrievalParams.enable_agent_docs && queryEmbedding.length > 0) {
      const { data: agentDocs } = await supabaseClient.rpc('match_agent_documents', {
        query_embedding: queryEmbedding,
        agent_id_param: agent_id,
        match_threshold: retrievalParams.similarity_threshold || 0.7,
        match_count: retrievalParams.max_chunks_per_source || 5
      });

      if (agentDocs) {
        agentDocs.forEach((doc: any) => {
          contextSources.push({
            tier: 'agentDocs',
            content: doc.content,
            relevanceScore: doc.similarity,
            metadata: { source: doc.title, document_id: doc.id }
          });
        });
      }
    }

    // Shared company documents
    if (retrievalParams.enable_shared_docs && company_id && queryEmbedding.length > 0) {
      const { data: sharedDocs } = await supabaseClient.rpc('match_shared_documents', {
        query_embedding: queryEmbedding,
        company_id_param: company_id,
        match_threshold: retrievalParams.similarity_threshold || 0.7,
        match_count: retrievalParams.max_chunks_per_source || 5
      });

      if (sharedDocs) {
        sharedDocs.forEach((doc: any) => {
          contextSources.push({
            tier: 'sharedDocs',
            content: doc.content,
            relevanceScore: doc.similarity,
            metadata: { source: doc.title, document_id: doc.id }
          });
        });
      }
    }

    // Playbooks
    if (retrievalParams.enable_playbooks && company_id) {
      const { data: playbooks } = await supabaseClient
        .from('playbook_documents')
        .select('title, content')
        .eq('company_id', company_id)
        .eq('status', 'complete')
        .limit(retrievalParams.max_chunks_per_source || 3);

      if (playbooks) {
        playbooks.forEach((playbook: any) => {
          contextSources.push({
            tier: 'playbooks',
            content: playbook.content.substring(0, 1000),
            metadata: { source: playbook.title }
          });
        });
      }
    }

    // 4. Limit total context chunks
    const maxChunks = retrievalParams.total_max_chunks || 15;
    const limitedContext = contextSources.slice(0, maxChunks);

    // 5. Build context-aware prompt
    const contextText = limitedContext.map((source, idx) =>
      `[${idx + 1}] ${source.tier}: ${source.content}`
    ).join('\n\n');

    const systemPrompt = agent.system_instructions || `You are ${agent.name}, a ${agent.role}. Use the following context to answer questions accurately and helpfully.`;

    const finalPrompt = contextText
      ? `${systemPrompt}\n\n=== CONTEXT ===\n${contextText}\n\n=== USER QUESTION ===\n${message}`
      : `${systemPrompt}\n\n${message}`;

    // 6. Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: agent.model_name || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalPrompt }
        ],
        temperature: agent.temperature || 0.7,
        max_tokens: agent.max_response_length || 2000,
      }),
    });

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    // 7. Save messages to database
    if (conversation_id) {
      // Save user message
      await supabaseClient.from('chat_messages').insert({
        conversation_id,
        content: message,
        role: 'user',
        agent_id: agent_id,
      });

      // Save assistant message
      await supabaseClient.from('chat_messages').insert({
        conversation_id,
        content: assistantMessage,
        role: 'assistant',
        agent_id: agent_id,
        content_metadata: {
          context_used: limitedContext.length > 0,
          citations: limitedContext.map((source, idx) => ({
            id: `citation-${idx}`,
            tier: source.tier,
            content: source.content.substring(0, 200),
            relevanceScore: source.relevanceScore,
            metadata: source.metadata
          }))
        }
      });
    }

    // 8. Log context retrieval for analytics
    await supabaseClient.from('context_retrievals').insert({
      agent_id,
      company_id,
      user_id,
      query: message,
      context_sources: limitedContext.map(s => s.tier),
      total_chunks_retrieved: limitedContext.length,
      confidence_score: limitedContext.length > 0 ? 0.85 : 0.5,
      retrieval_time_ms: 800, // Placeholder
      query_expansion_used: false,
      reranking_used: false,
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        context_metadata: {
          context_used: limitedContext.length > 0,
          citations: limitedContext.map((source, idx) => ({
            id: `citation-${idx}`,
            tier: source.tier,
            content: source.content.substring(0, 200),
            relevanceScore: source.relevanceScore,
            metadata: source.metadata
          }))
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in chat-with-agent-v2:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
