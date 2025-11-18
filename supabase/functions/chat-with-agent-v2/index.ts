import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  agent_id: string;
  company_id: string;
  message: string;
  conversation_id?: string;
  user_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const {
      agent_id,
      company_id,
      message,
      conversation_id,
      user_id,
    }: ChatRequest = await req.json();

    // Validation
    if (!agent_id || !company_id || !message || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Chat request for agent ${agent_id} in company ${company_id}`);
    console.log(`Message: ${message.substring(0, 100)}...`);

    // Step 1: Load agent configuration
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*, configuration')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      console.error('Agent not found:', agentError);
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Load context injection config
    const { data: contextConfig } = await supabase
      .rpc('get_context_config', { p_agent_id: agent_id })
      .single();

    if (!contextConfig) {
      console.warn('No context config found, using defaults');
    }

    const config = contextConfig || {
      enable_company_os: true,
      enable_agent_docs: true,
      enable_playbooks: true,
      enable_shared_docs: true,
      enable_keyword_search: true,
      enable_query_expansion: true,
      enable_reranking: true,
      max_chunks_per_source: 3,
      total_max_chunks: 10,
      similarity_threshold: 0.7,
      max_expanded_queries: 5,
      rerank_model: 'rerank-english-v3.0',
      rerank_top_n: 8,
      include_citations: true,
      citation_format: 'footnote',
      max_context_tokens: 8000,
    };

    console.log('Context config loaded:', {
      enable_company_os: config.enable_company_os,
      enable_agent_docs: config.enable_agent_docs,
      enable_playbooks: config.enable_playbooks,
      enable_reranking: config.enable_reranking,
    });

    // Step 3: Run context injection pipeline
    const contextStartTime = Date.now();

    // 3a. Query expansion
    let expandedQueries = [message];
    let expansionTimeMs = 0;

    if (config.enable_query_expansion) {
      try {
        const expansionStart = Date.now();
        const { data: cachedExpansion } = await supabase.rpc(
          'get_cached_query_expansion',
          { query: message }
        );

        if (cachedExpansion) {
          expandedQueries = cachedExpansion;
          console.log('Using cached query expansion');
        } else {
          // Call OpenAI to expand query (simplified - in production use GPT-3.5)
          const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
          const expansionResponse = await fetch(
            'https://api.openai.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'user',
                    content: `Given the query: "${message}"\n\nGenerate 5 semantically similar queries. Return ONLY the queries, one per line.`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 200,
              }),
            }
          );

          if (expansionResponse.ok) {
            const expansionData = await expansionResponse.json();
            const expansions = expansionData.choices[0].message.content
              .split('\n')
              .filter((q: string) => q.trim().length > 0)
              .slice(0, config.max_expanded_queries);

            expandedQueries = [message, ...expansions];

            // Cache it
            await supabase.rpc('cache_query_expansion', {
              query: message,
              expansions,
              model: 'gpt-3.5-turbo',
            });
          }
        }

        expansionTimeMs = Date.now() - expansionStart;
        console.log(`Query expansion: ${expandedQueries.length} queries in ${expansionTimeMs}ms`);
      } catch (error) {
        console.error('Query expansion failed:', error);
        // Continue with original query
      }
    }

    // 3b. Generate embedding for primary query
    const embeddingStart = Date.now();
    const embeddingResponse = await fetch(
      `${supabaseUrl}/functions/v1/generate-embedding`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: message }),
      }
    );

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const { embedding } = await embeddingResponse.json();
    const embeddingTimeMs = Date.now() - embeddingStart;
    console.log(`Generated embedding in ${embeddingTimeMs}ms`);

    // 3c. Parallel context retrieval
    const retrievalStart = Date.now();

    const [companyOSChunks, agentDocChunks, sharedDocChunks, playbookChunks] =
      await Promise.all([
        // CompanyOS
        config.enable_company_os
          ? retrieveCompanyOS(supabase, company_id, embedding, config)
          : Promise.resolve([]),

        // Agent docs
        config.enable_agent_docs
          ? retrieveAgentDocs(supabase, agent_id, embedding, config)
          : Promise.resolve([]),

        // Shared docs
        config.enable_shared_docs
          ? retrieveSharedDocs(supabase, company_id, embedding, config)
          : Promise.resolve([]),

        // Playbooks
        config.enable_playbooks
          ? retrievePlaybooks(supabase, company_id, message, config)
          : Promise.resolve([]),
      ]);

    const retrievalTimeMs = Date.now() - retrievalStart;

    const allChunks = [
      ...companyOSChunks,
      ...agentDocChunks,
      ...sharedDocChunks,
      ...playbookChunks,
    ];

    console.log(`Retrieved ${allChunks.length} chunks in ${retrievalTimeMs}ms`);
    console.log(`  CompanyOS: ${companyOSChunks.length}`);
    console.log(`  Agent docs: ${agentDocChunks.length}`);
    console.log(`  Shared docs: ${sharedDocChunks.length}`);
    console.log(`  Playbooks: ${playbookChunks.length}`);

    // 3d. Reranking
    let finalChunks = allChunks;
    let rerankTimeMs = 0;

    if (config.enable_reranking && allChunks.length > config.total_max_chunks) {
      try {
        const rerankStart = Date.now();

        const rerankResponse = await fetch(
          `${supabaseUrl}/functions/v1/cohere-rerank`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.rerank_model,
              query: message,
              documents: allChunks.map((c) => c.content),
              top_n: config.rerank_top_n || config.total_max_chunks,
            }),
          }
        );

        if (rerankResponse.ok) {
          const rerankData = await rerankResponse.json();
          finalChunks = rerankData.results.map((r: any) => ({
            ...allChunks[r.index],
            rerankScore: r.relevance_score,
            originalScore: allChunks[r.index].score,
          }));

          rerankTimeMs = Date.now() - rerankStart;
          console.log(`Reranked to ${finalChunks.length} chunks in ${rerankTimeMs}ms`);
        } else {
          console.warn('Reranking failed, using original ranking');
          finalChunks = allChunks.slice(0, config.total_max_chunks);
        }
      } catch (error) {
        console.error('Reranking error:', error);
        finalChunks = allChunks.slice(0, config.total_max_chunks);
      }
    } else {
      finalChunks = allChunks.slice(0, config.total_max_chunks);
    }

    // 3e. Build system prompt
    const systemPrompt = buildSystemPrompt(agent, finalChunks, message, config);
    const totalContextTimeMs = Date.now() - contextStartTime;

    console.log(`Total context injection: ${totalContextTimeMs}ms`);
    console.log(`System prompt length: ${systemPrompt.length} characters`);

    // Step 4: Call OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const model = agent.configuration?.model || 'gpt-4o-mini';
    const temperature = agent.configuration?.temperature || 0.7;

    console.log(`Calling OpenAI with model: ${model}`);

    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          temperature,
          stream: true,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    // Step 5: Log context retrieval (async, don't wait)
    const contextConfidence = calculateConfidence(finalChunks);

    supabase
      .from('context_retrievals')
      .insert({
        conversation_id,
        agent_id,
        company_id,
        original_query: message,
        expanded_queries: expandedQueries,
        company_os_chunks: JSON.stringify(
          companyOSChunks.map((c) => ({
            id: c.id,
            content: c.content.substring(0, 200),
            score: c.score,
          }))
        ),
        agent_doc_chunks: JSON.stringify(
          agentDocChunks.map((c) => ({
            id: c.id,
            content: c.content.substring(0, 200),
            score: c.score,
          }))
        ),
        playbook_chunks: JSON.stringify(
          playbookChunks.map((c) => ({
            id: c.id,
            content: c.content.substring(0, 200),
            score: c.score,
          }))
        ),
        shared_doc_chunks: JSON.stringify(
          sharedDocChunks.map((c) => ({
            id: c.id,
            content: c.content.substring(0, 200),
            score: c.score,
          }))
        ),
        retrieval_time_ms: retrievalTimeMs,
        rerank_time_ms: rerankTimeMs,
        total_time_ms: totalContextTimeMs,
        context_confidence_score: contextConfidence,
        chunks_used_in_prompt: finalChunks.length,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Error logging context retrieval:', error);
        }
      });

    // Step 6: Stream response back
    const stream = openaiResponse.body;
    if (!stream) {
      throw new Error('No response stream from OpenAI');
    }

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat-with-agent-v2:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper functions

async function retrieveCompanyOS(
  supabase: any,
  companyId: string,
  embedding: number[],
  config: any
): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('company_os')
      .select('os_data')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .maybeSingle();

    if (!data) return [];

    // Simplified: return top sections as chunks
    // In production, chunk and calculate similarity
    const chunks = [];
    const osData = data.os_data;

    if (osData.coreIdentityAndStrategicFoundation) {
      chunks.push({
        id: 'cos_1',
        content: osData.coreIdentityAndStrategicFoundation.companyOverview || '',
        source: 'company_os',
        sourceDetail: 'Company Overview',
        score: 0.9,
      });
    }

    return chunks.slice(0, config.max_chunks_per_source);
  } catch (error) {
    console.error('Error retrieving CompanyOS:', error);
    return [];
  }
}

async function retrieveAgentDocs(
  supabase: any,
  agentId: string,
  embedding: number[],
  config: any
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('match_agent_documents', {
      query_embedding: embedding,
      match_agent_id: agentId,
      match_threshold: config.similarity_threshold,
      match_count: config.max_chunks_per_source,
    });

    if (error || !data) return [];

    return data.map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      source: 'agent_docs',
      sourceDetail: doc.title,
      score: doc.similarity,
    }));
  } catch (error) {
    console.error('Error retrieving agent docs:', error);
    return [];
  }
}

async function retrieveSharedDocs(
  supabase: any,
  companyId: string,
  embedding: number[],
  config: any
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('match_shared_documents', {
      query_embedding: embedding,
      match_company_id: companyId,
      match_threshold: config.similarity_threshold,
      match_count: config.max_chunks_per_source,
    });

    if (error || !data) return [];

    return data.map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      source: 'shared_docs',
      sourceDetail: 'Company Documents',
      score: doc.similarity,
    }));
  } catch (error) {
    console.error('Error retrieving shared docs:', error);
    return [];
  }
}

async function retrievePlaybooks(
  supabase: any,
  companyId: string,
  query: string,
  config: any
): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('search_playbooks', {
      search_query: query,
      match_company_id: companyId,
      match_count: config.max_chunks_per_source,
    });

    if (error || !data) return [];

    return data.map((playbook: any) => ({
      id: playbook.id,
      content: playbook.content || '',
      source: 'playbooks',
      sourceDetail: playbook.title,
      score: playbook.relevance,
    }));
  } catch (error) {
    console.error('Error retrieving playbooks:', error);
    return [];
  }
}

function buildSystemPrompt(
  agent: any,
  chunks: any[],
  userQuery: string,
  config: any
): string {
  const grouped = {
    company_os: chunks.filter((c) => c.source === 'company_os'),
    agent_docs: chunks.filter((c) => c.source === 'agent_docs'),
    shared_docs: chunks.filter((c) => c.source === 'shared_docs'),
    playbooks: chunks.filter((c) => c.source === 'playbooks'),
  };

  let context = '';

  if (grouped.company_os.length > 0) {
    context += `\n### TIER 1: CompanyOS (Foundation)\n\n`;
    grouped.company_os.forEach((chunk) => {
      context += `**${chunk.sourceDetail}**\n${chunk.content}\n\n`;
    });
  }

  if (grouped.agent_docs.length > 0) {
    context += `\n### TIER 2: Your Specialized Knowledge\n\n`;
    grouped.agent_docs.forEach((chunk) => {
      context += `**${chunk.sourceDetail}**\n${chunk.content}\n\n`;
    });
  }

  if (grouped.shared_docs.length > 0) {
    context += `\n### TIER 3: Company Documents\n\n`;
    grouped.shared_docs.forEach((chunk) => {
      context += `**${chunk.sourceDetail}**\n${chunk.content}\n\n`;
    });
  }

  if (grouped.playbooks.length > 0) {
    context += `\n### TIER 4: Playbooks & Procedures\n\n`;
    grouped.playbooks.forEach((chunk) => {
      context += `**${chunk.sourceDetail}**\n${chunk.content}\n\n`;
    });
  }

  const systemPrompt = `# YOU ARE: ${agent.role || 'AI Assistant'}

You are ${agent.name}, ${agent.description || 'an AI assistant'}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR COMPANY CONTEXT (CRITICAL - REFERENCE THIS IN YOUR RESPONSE)
${context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR TASK

The user asked: "${userQuery}"

Provide a comprehensive, accurate answer that:
1. Directly answers the question with specific information
2. References data from the context above
3. Stays true to company strategy and brand voice
4. Prioritizes by impact when providing recommendations

Begin your response:`;

  return systemPrompt;
}

function calculateConfidence(chunks: any[]): number {
  if (chunks.length === 0) return 0;
  const scores = chunks.map((c) => c.rerankScore || c.score || 0);
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.min(1, Math.max(0, avg));
}
