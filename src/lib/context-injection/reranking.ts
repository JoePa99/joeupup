import type { ContextChunk, RerankResult } from '@/types/context-injection';

/**
 * Reranks retrieved context chunks using Cohere Rerank API
 * This improves relevance by considering the exact query-document relationship
 *
 * @param query - The original user query
 * @param chunks - Retrieved context chunks to rerank
 * @param topN - Number of top chunks to return after reranking
 * @param model - Cohere rerank model to use
 * @returns Reranked chunks with updated scores
 */
export async function rerankChunks(
  query: string,
  chunks: ContextChunk[],
  topN: number = 10,
  model: string = 'rerank-english-v3.0'
): Promise<RerankResult> {
  if (chunks.length === 0) {
    return {
      chunks: [],
      rerankTimeMs: 0,
    };
  }

  // If we have fewer chunks than topN, no need to rerank
  if (chunks.length <= topN) {
    return {
      chunks,
      rerankTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // Call Cohere Rerank API
    const reranked = await cohereRerank(query, chunks, topN, model);

    const rerankTime = Date.now() - startTime;

    console.log(
      `Reranked ${chunks.length} → ${reranked.length} chunks in ${rerankTime}ms`
    );

    return {
      chunks: reranked,
      rerankTimeMs: rerankTime,
    };
  } catch (error) {
    console.error('Reranking failed, falling back to original order:', error);

    // Fallback: return top N by original score
    return {
      chunks: chunks.sort((a, b) => b.score - a.score).slice(0, topN),
      rerankTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Calls Cohere Rerank API via edge function
 */
async function cohereRerank(
  query: string,
  chunks: ContextChunk[],
  topN: number,
  model: string
): Promise<ContextChunk[]> {
  // In production, this would call a Supabase edge function that talks to Cohere
  // For now, we'll create a placeholder that simulates the API

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cohere-rerank`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents: chunks.map((c) => c.content),
        top_n: topN,
        return_documents: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Cohere API error: ${response.statusText}`);
  }

  const data = await response.json();

  // Map reranked results back to original chunks with new scores
  const reranked = data.results.map((result: any) => ({
    ...chunks[result.index],
    rerankScore: result.relevance_score,
    originalScore: chunks[result.index].score,
  }));

  return reranked;
}

/**
 * Alternative reranking using cross-encoder model (self-hosted)
 * Use this if you don't want to pay for Cohere API
 */
export async function rerankWithCrossEncoder(
  query: string,
  chunks: ContextChunk[],
  topN: number = 10
): Promise<RerankResult> {
  if (chunks.length === 0) {
    return {
      chunks: [],
      rerankTimeMs: 0,
    };
  }

  if (chunks.length <= topN) {
    return {
      chunks,
      rerankTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // Score each chunk against the query using cross-encoder
    const scoredChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const score = await getCrossEncoderScore(query, chunk.content);
        return {
          ...chunk,
          rerankScore: score,
          originalScore: chunk.score,
        };
      })
    );

    // Sort by rerank score and take top N
    const reranked = scoredChunks
      .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
      .slice(0, topN);

    return {
      chunks: reranked,
      rerankTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Cross-encoder reranking failed:', error);

    // Fallback
    return {
      chunks: chunks.sort((a, b) => b.score - a.score).slice(0, topN),
      rerankTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Gets cross-encoder score for query-document pair
 * In production, this would call a self-hosted model or Hugging Face API
 */
async function getCrossEncoderScore(
  query: string,
  document: string
): Promise<number> {
  // Placeholder implementation
  // In production, call your cross-encoder model endpoint

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cross-encoder-score`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          query,
          document,
          model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Cross-encoder API error');
    }

    const data = await response.json();
    return data.score || 0;
  } catch (error) {
    console.error('Error getting cross-encoder score:', error);
    return 0;
  }
}

/**
 * Simple fallback reranking using BM25 algorithm
 * No external API required, but less accurate than neural rerankers
 */
export function rerankWithBM25(
  query: string,
  chunks: ContextChunk[],
  topN: number = 10
): RerankResult {
  const startTime = Date.now();

  // Tokenize query
  const queryTerms = tokenize(query.toLowerCase());

  // Score each chunk using BM25
  const scored = chunks.map((chunk) => {
    const score = calculateBM25Score(queryTerms, chunk.content, chunks.length);
    return {
      ...chunk,
      rerankScore: score,
      originalScore: chunk.score,
    };
  });

  // Sort and take top N
  const reranked = scored
    .sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
    .slice(0, topN);

  return {
    chunks: reranked,
    rerankTimeMs: Date.now() - startTime,
  };
}

/**
 * Simple tokenization (split on whitespace and punctuation)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

/**
 * Calculate BM25 score for a document given query terms
 * Simplified implementation (full BM25 requires document frequency stats)
 */
function calculateBM25Score(
  queryTerms: string[],
  document: string,
  corpusSize: number
): number {
  const docTerms = tokenize(document);
  const docLength = docTerms.length;
  const avgDocLength = 100; // Rough estimate
  const k1 = 1.5;
  const b = 0.75;

  let score = 0;

  for (const term of queryTerms) {
    const termFreq = docTerms.filter((t) => t === term).length;
    if (termFreq === 0) continue;

    // Simplified IDF (inverse document frequency)
    const idf = Math.log(corpusSize / (1 + 1)); // Assuming term appears in 1 doc

    // BM25 formula
    const numerator = termFreq * (k1 + 1);
    const denominator =
      termFreq + k1 * (1 - b + b * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }

  return score;
}
