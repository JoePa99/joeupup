import { supabase } from '@/integrations/supabase/client';
import type {
  QueryExpansionOptions,
  QueryExpansionResult,
} from '@/types/context-injection';

/**
 * Expands a user query into semantically similar variations
 * Uses caching to avoid repeated LLM calls for common queries
 *
 * @param query - The original user query
 * @param options - Configuration options
 * @returns Expanded query variations including the original
 */
export async function expandQuery(
  query: string,
  options: QueryExpansionOptions = {}
): Promise<QueryExpansionResult> {
  const {
    maxExpansions = 5,
    useCache = true,
    model = 'gpt-3.5-turbo',
  } = options;

  const startTime = Date.now();

  // Check cache first
  if (useCache) {
    const cached = await getCachedExpansion(query);
    if (cached) {
      return {
        originalQuery: query,
        expandedQueries: cached,
        fromCache: true,
      };
    }
  }

  // Call LLM to generate expansions
  const expansions = await generateQueryExpansions(query, maxExpansions, model);

  // Cache the result
  if (useCache) {
    await cacheQueryExpansion(query, expansions, model);
  }

  return {
    originalQuery: query,
    expandedQueries: [query, ...expansions], // Include original first
    fromCache: false,
    expansionTimeMs: Date.now() - startTime,
  };
}

/**
 * Retrieves cached query expansion if available and not expired
 */
async function getCachedExpansion(query: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_cached_query_expansion', {
      query,
    });

    if (error) {
      console.error('Error fetching cached query expansion:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error in getCachedExpansion:', error);
    return null;
  }
}

/**
 * Generates query expansions using OpenAI
 */
async function generateQueryExpansions(
  query: string,
  maxExpansions: number,
  model: string
): Promise<string[]> {
  try {
    const prompt = `Given the query: "${query}"

Generate ${maxExpansions} semantically similar queries that capture different phrasings and related concepts. These will be used for semantic search to retrieve relevant information.

Guidelines:
- Use synonyms and alternative phrasings
- Include related business concepts
- Vary the specificity (some more general, some more specific)
- Keep queries concise (5-15 words each)
- Make them sound natural, as if asked by a business user

Return ONLY the queries, one per line, without numbering or explanation.`;

    // Call OpenAI via Supabase edge function
    const { data, error } = await supabase.functions.invoke('openai-chat', {
      body: {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
      },
    });

    if (error) {
      console.error('Error generating query expansions:', error);
      return [];
    }

    // Parse response
    const responseText = data.choices?.[0]?.message?.content || '';
    const expansions = responseText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .slice(0, maxExpansions);

    return expansions;
  } catch (error) {
    console.error('Unexpected error in generateQueryExpansions:', error);
    return [];
  }
}

/**
 * Caches query expansion for future use
 */
async function cacheQueryExpansion(
  query: string,
  expansions: string[],
  model: string
): Promise<void> {
  try {
    await supabase.rpc('cache_query_expansion', {
      query,
      expansions,
      model,
    });
  } catch (error) {
    console.error('Error caching query expansion:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Generates MD5 hash for query (used for cache key)
 * Note: This is a simple implementation. In production, use a proper hashing library
 */
export function generateQueryHash(query: string): string {
  // Normalize: lowercase, trim, collapse whitespace
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');

  // Simple hash function (for demo purposes)
  // In production, use crypto.subtle.digest or a library
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Cleans up expired cache entries
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_query_cache');

    if (error) {
      console.error('Error cleaning up expired cache:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Unexpected error in cleanupExpiredCache:', error);
    return 0;
  }
}

/**
 * Cleans up stale cache entries (not used in 90 days)
 * Should be called periodically
 */
export async function cleanupStaleCache(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_stale_query_cache');

    if (error) {
      console.error('Error cleaning up stale cache:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Unexpected error in cleanupStaleCache:', error);
    return 0;
  }
}
