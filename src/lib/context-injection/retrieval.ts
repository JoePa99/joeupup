import { supabase } from '@/integrations/supabase/client';
import type {
  ContextChunk,
  ContextInjectionConfig,
  RetrievalResult,
} from '@/types/context-injection';
import type { CompanyOSData } from '@/types/company-os';
import { formatCompanyOSAsContext } from '@/lib/company-os';

/**
 * Retrieves context from multiple sources in parallel
 * This is the core of the context injection system
 *
 * @param agentId - The agent ID
 * @param companyId - The company ID
 * @param queries - Array of query variations (original + expansions)
 * @param config - Context injection configuration
 * @returns Retrieved context chunks from all sources
 */
export async function retrieveContext(
  agentId: string,
  companyId: string,
  queries: string[],
  config: ContextInjectionConfig
): Promise<RetrievalResult> {
  const startTime = Date.now();

  // Generate embedding for primary query (used for vector searches)
  const queryEmbedding = await generateEmbedding(queries[0]);

  // Execute all retrievals in parallel for maximum speed
  const [
    companyOSChunks,
    agentDocChunks,
    sharedDocChunks,
    playbookChunks,
    keywordMatches,
  ] = await Promise.all([
    // Tier 1: CompanyOS
    config.enable_company_os
      ? searchCompanyOS(companyId, queryEmbedding, queries, config)
      : Promise.resolve([]),

    // Tier 2: Agent-specific docs
    config.enable_agent_docs
      ? searchAgentDocs(agentId, queryEmbedding, config)
      : Promise.resolve([]),

    // Tier 3: Shared company docs
    config.enable_shared_docs
      ? searchSharedDocs(companyId, queryEmbedding, config)
      : Promise.resolve([]),

    // Tier 4: Playbooks
    config.enable_playbooks
      ? searchPlaybooks(companyId, queries, config)
      : Promise.resolve([]),

    // Tier 5: Keyword search
    config.enable_keyword_search
      ? keywordSearch(companyId, agentId, queries, config)
      : Promise.resolve([]),
  ]);

  const retrievalTime = Date.now() - startTime;
  const totalChunks =
    companyOSChunks.length +
    agentDocChunks.length +
    sharedDocChunks.length +
    playbookChunks.length +
    keywordMatches.length;

  return {
    companyOS: companyOSChunks,
    agentDocs: agentDocChunks,
    sharedDocs: sharedDocChunks,
    playbooks: playbookChunks,
    keywords: keywordMatches,
    retrievalTimeMs: retrievalTime,
    totalChunks,
  };
}

/**
 * Searches CompanyOS by chunking and semantic similarity
 */
async function searchCompanyOS(
  companyId: string,
  queryEmbedding: number[],
  queries: string[],
  config: ContextInjectionConfig
): Promise<ContextChunk[]> {
  try {
    // Fetch CompanyOS
    const { data, error } = await supabase
      .from('company_os')
      .select('os_data, version')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .maybeSingle();

    if (error || !data) {
      console.warn('No CompanyOS found for company:', companyId);
      return [];
    }

    // Chunk CompanyOS into searchable sections
    const chunks = chunkCompanyOS(data.os_data as CompanyOSData);

    // Generate embeddings for each chunk (in production, these should be pre-computed and cached)
    const chunkEmbeddings = await Promise.all(
      chunks.map((chunk) => generateEmbedding(chunk.content))
    );

    // Calculate cosine similarity
    const scored = chunks.map((chunk, i) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i]),
    }));

    // Filter by threshold and return top N
    return scored
      .filter((chunk) => chunk.score >= config.similarity_threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, config.max_chunks_per_source);
  } catch (error) {
    console.error('Error searching CompanyOS:', error);
    return [];
  }
}

/**
 * Searches agent-specific documents using vector similarity
 */
async function searchAgentDocs(
  agentId: string,
  queryEmbedding: number[],
  config: ContextInjectionConfig
): Promise<ContextChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_agent_documents', {
      query_embedding: queryEmbedding,
      match_agent_id: agentId,
      match_threshold: config.similarity_threshold,
      match_count: config.max_chunks_per_source,
    });

    if (error) {
      console.error('Error searching agent documents:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      source: 'agent_docs' as const,
      sourceDetail: doc.title,
      score: doc.similarity,
      metadata: {
        fileName: doc.source_file_name,
        uploadedAt: doc.created_at,
        chunkIndex: doc.chunk_index,
        totalChunks: doc.total_chunks,
        ...doc.metadata,
      },
    }));
  } catch (error) {
    console.error('Error in searchAgentDocs:', error);
    return [];
  }
}

/**
 * Searches shared company documents using vector similarity
 */
async function searchSharedDocs(
  companyId: string,
  queryEmbedding: number[],
  config: ContextInjectionConfig
): Promise<ContextChunk[]> {
  try {
    const { data, error } = await supabase.rpc('match_shared_documents', {
      query_embedding: queryEmbedding,
      match_company_id: companyId,
      match_threshold: config.similarity_threshold,
      match_count: config.max_chunks_per_source,
    });

    if (error) {
      console.error('Error searching shared documents:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((doc: any) => ({
      id: doc.id,
      content: doc.content,
      source: 'shared_docs' as const,
      sourceDetail: 'Company Documents',
      score: doc.similarity,
      metadata: doc.metadata || {},
    }));
  } catch (error) {
    console.error('Error in searchSharedDocs:', error);
    return [];
  }
}

/**
 * Searches playbooks using full-text search
 */
async function searchPlaybooks(
  companyId: string,
  queries: string[],
  config: ContextInjectionConfig
): Promise<ContextChunk[]> {
  try {
    // Use the first query for playbook search
    const searchQuery = queries[0];

    const { data, error } = await supabase.rpc('search_playbooks', {
      search_query: searchQuery,
      match_company_id: companyId,
      match_count: config.max_chunks_per_source,
    });

    if (error) {
      console.error('Error searching playbooks:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((playbook: any) => ({
      id: playbook.id,
      content: playbook.content || '',
      source: 'playbooks' as const,
      sourceDetail: playbook.title,
      score: playbook.relevance,
      metadata: {
        section_order: playbook.section_order,
        tags: playbook.tags,
      },
    }));
  } catch (error) {
    console.error('Error in searchPlaybooks:', error);
    return [];
  }
}

/**
 * Performs keyword search across all sources
 */
async function keywordSearch(
  companyId: string,
  agentId: string,
  queries: string[],
  config: ContextInjectionConfig
): Promise<ContextChunk[]> {
  try {
    const searchQuery = queries[0];

    const { data, error } = await supabase.rpc('keyword_search_all_sources', {
      search_query: searchQuery,
      match_company_id: companyId,
      match_agent_id: agentId,
      match_count: config.max_chunks_per_source,
    });

    if (error) {
      console.error('Error in keyword search:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((result: any) => ({
      id: result.id,
      content: result.content,
      source: 'keywords' as const,
      sourceDetail: result.title,
      score: result.relevance,
      metadata: {
        original_source: result.source,
      },
    }));
  } catch (error) {
    console.error('Error in keywordSearch:', error);
    return [];
  }
}

/**
 * Chunks CompanyOS into searchable sections
 */
function chunkCompanyOS(osData: CompanyOSData): ContextChunk[] {
  const chunks: ContextChunk[] = [];
  let chunkId = 0;

  // Core Identity section
  if (osData.coreIdentityAndStrategicFoundation) {
    const core = osData.coreIdentityAndStrategicFoundation;

    chunks.push({
      id: `cos_${chunkId++}`,
      content: `Company Overview: ${core.companyOverview || ''}`,
      source: 'company_os',
      sourceDetail: 'Company Overview',
      score: 0,
      metadata: { section: 'Core Identity' },
    });

    if (core.missionAndVision) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Mission: ${core.missionAndVision.missionStatement}\nVision: ${core.missionAndVision.visionStatement}`,
        source: 'company_os',
        sourceDetail: 'Mission & Vision',
        score: 0,
        metadata: { section: 'Core Identity' },
      });
    }

    if (core.coreValues) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Core Values:\n${core.coreValues.join('\n')}`,
        source: 'company_os',
        sourceDetail: 'Core Values',
        score: 0,
        metadata: { section: 'Core Identity' },
      });
    }

    if (core.positioningStatement) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Positioning: For ${core.positioningStatement.targetSegment}, we are ${core.positioningStatement.category}. ${core.positioningStatement.uniqueBenefit}. ${core.positioningStatement.reasonToBelieve}`,
        source: 'company_os',
        sourceDetail: 'Positioning Statement',
        score: 0,
        metadata: { section: 'Core Identity' },
      });
    }

    if (core.businessModel) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Business Model:\nRevenue: ${core.businessModel.revenueModel}\nPricing: ${core.businessModel.pricingStrategy}\nDistribution: ${core.businessModel.distributionChannels}`,
        source: 'company_os',
        sourceDetail: 'Business Model',
        score: 0,
        metadata: { section: 'Core Identity' },
      });
    }
  }

  // Customer & Market section
  if (osData.customerAndMarketContext) {
    const customer = osData.customerAndMarketContext;

    if (customer.idealCustomerProfile) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Ideal Customer Profile:\n${customer.idealCustomerProfile.definingTraits}\n\nDemographics: ${customer.idealCustomerProfile.keyDemographics}\n\nPersona: ${customer.idealCustomerProfile.representativePersona}`,
        source: 'company_os',
        sourceDetail: 'Ideal Customer Profile',
        score: 0,
        metadata: { section: 'Customer & Market' },
      });
    }

    if (customer.customerJourney) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Customer Pain Points:\n${customer.customerJourney.topPainPoints}\n\nImprovement Opportunities:\n${customer.customerJourney.topImprovementOpportunities}`,
        source: 'company_os',
        sourceDetail: 'Customer Journey',
        score: 0,
        metadata: { section: 'Customer & Market' },
      });
    }

    if (customer.marketAnalysis) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Market Analysis:\n${customer.marketAnalysis.primaryCategoryAnalysis}\n\nCompetitors:\n${customer.marketAnalysis.topDirectCompetitors}`,
        source: 'company_os',
        sourceDetail: 'Market Analysis',
        score: 0,
        metadata: { section: 'Customer & Market' },
      });
    }
  }

  // Brand Voice section
  if (osData.brandVoiceAndExpression) {
    const brand = osData.brandVoiceAndExpression;

    chunks.push({
      id: `cos_${chunkId++}`,
      content: `Brand Purpose: ${brand.brandPurpose || ''}`,
      source: 'company_os',
      sourceDetail: 'Brand Purpose',
      score: 0,
      metadata: { section: 'Brand Voice' },
    });

    if (brand.brandVoiceDosAndDonts) {
      chunks.push({
        id: `cos_${chunkId++}`,
        content: `Brand Voice Guidelines:\n\nDO:\n${brand.brandVoiceDosAndDonts.dos}\n\nDON'T:\n${brand.brandVoiceDosAndDonts.donts}`,
        source: 'company_os',
        sourceDetail: 'Brand Voice Guidelines',
        score: 0,
        metadata: { section: 'Brand Voice' },
      });
    }
  }

  return chunks;
}

/**
 * Generates embedding for text using OpenAI
 * In production, this should call an edge function
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        body: { text },
      }
    );

    if (error) {
      console.error('Error generating embedding:', error);
      return [];
    }

    return data.embedding || [];
  } catch (error) {
    console.error('Unexpected error in generateEmbedding:', error);
    return [];
  }
}

/**
 * Calculates cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.error('Vector length mismatch');
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
