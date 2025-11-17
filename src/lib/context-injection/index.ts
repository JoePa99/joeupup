/**
 * Context Injection System
 *
 * This module provides sophisticated multi-tier context retrieval and injection
 * for AI assistants. It includes:
 *
 * 1. Query Expansion - Expand user queries into semantic variations
 * 2. Multi-Tier Retrieval - Retrieve context from CompanyOS, agent docs, playbooks, etc.
 * 3. Reranking - Rerank retrieved chunks using Cohere or cross-encoder
 * 4. Prompt Building - Assemble context into structured prompts with citations
 *
 * Usage:
 * ```typescript
 * import { orchestrateContextInjection } from '@/lib/context-injection';
 *
 * const result = await orchestrateContextInjection(
 *   agentId,
 *   companyId,
 *   userQuery,
 *   config
 * );
 *
 * // Use result.systemPrompt in OpenAI chat
 * ```
 */

// Export individual services
export * from './query-expansion';
export * from './retrieval';
export * from './reranking';
export * from './prompt-builder';

// Export orchestration function
import { expandQuery } from './query-expansion';
import { retrieveContext } from './retrieval';
import { rerankChunks } from './reranking';
import { buildContextualPrompt, formatCitationFooter } from './prompt-builder';
import type {
  ContextInjectionConfig,
  PromptBuildResult,
} from '@/types/context-injection';
import type { Agent } from '@/integrations/supabase/types';

export interface ContextInjectionResult {
  systemPrompt: string;
  promptBuildResult: PromptBuildResult;
  retrievalTimeMs: number;
  rerankTimeMs: number;
  expansionTimeMs: number;
  totalTimeMs: number;
  chunksRetrieved: number;
  chunksUsed: number;
  contextConfidence: number;
  citationFooter: string;
}

/**
 * Orchestrates the full context injection pipeline
 *
 * This is the main entry point for the context injection system.
 * It handles the full pipeline from query expansion to prompt assembly.
 *
 * @param agent - The agent configuration
 * @param companyId - The company ID
 * @param userQuery - The user's query
 * @param config - Context injection configuration
 * @returns Complete context injection result with prompt and metadata
 */
export async function orchestrateContextInjection(
  agent: Agent,
  companyId: string,
  userQuery: string,
  config: ContextInjectionConfig
): Promise<ContextInjectionResult> {
  const startTime = Date.now();

  // Step 1: Query expansion
  const expansionResult = config.enable_query_expansion
    ? await expandQuery(userQuery, {
        maxExpansions: config.max_expanded_queries,
        useCache: true,
      })
    : {
        originalQuery: userQuery,
        expandedQueries: [userQuery],
        fromCache: false,
        expansionTimeMs: 0,
      };

  // Step 2: Multi-tier context retrieval
  const retrievalResult = await retrieveContext(
    agent.id!,
    companyId,
    expansionResult.expandedQueries,
    config
  );

  // Step 3: Combine all chunks
  const allChunks = [
    ...retrievalResult.companyOS,
    ...retrievalResult.agentDocs,
    ...retrievalResult.sharedDocs,
    ...retrievalResult.playbooks,
    ...retrievalResult.keywords,
  ];

  // Step 4: Reranking
  const rerankResult = config.enable_reranking
    ? await rerankChunks(
        userQuery,
        allChunks,
        config.rerank_top_n || config.total_max_chunks,
        config.rerank_model
      )
    : {
        chunks: allChunks.slice(0, config.total_max_chunks),
        rerankTimeMs: 0,
      };

  // Step 5: Build prompt
  const promptResult = buildContextualPrompt(
    agent,
    rerankResult.chunks,
    userQuery,
    config
  );

  // Step 6: Calculate context confidence
  const contextConfidence = calculateContextConfidence(rerankResult.chunks);

  // Step 7: Format citation footer
  const citationFooter = formatCitationFooter(
    rerankResult.chunks,
    contextConfidence,
    retrievalResult.retrievalTimeMs
  );

  const totalTime = Date.now() - startTime;

  return {
    systemPrompt: promptResult.systemPrompt,
    promptBuildResult: promptResult,
    retrievalTimeMs: retrievalResult.retrievalTimeMs,
    rerankTimeMs: rerankResult.rerankTimeMs,
    expansionTimeMs: expansionResult.expansionTimeMs || 0,
    totalTimeMs: totalTime,
    chunksRetrieved: allChunks.length,
    chunksUsed: rerankResult.chunks.length,
    contextConfidence,
    citationFooter,
  };
}

/**
 * Calculates context confidence score based on chunk relevance scores
 */
function calculateContextConfidence(chunks: any[]): number {
  if (chunks.length === 0) return 0;

  const scores = chunks.map((c) => c.rerankScore || c.score || 0);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return Math.min(1, Math.max(0, avgScore));
}
