import { generateQueryEmbedding } from './embedding-config.ts';

export type TierName = 'companyOS' | 'agentDocs' | 'playbooks' | 'keywords';

export interface ContextChunk {
  id: string;
  tier: TierName;
  content: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

export interface TieredContext {
  companyOS: ContextChunk[];
  agentDocs: ContextChunk[];
  playbooks: ContextChunk[];
  keywords: ContextChunk[];
  structuredSummary?: string;
}

interface CompanyOSBundle {
  chunks: ContextChunk[];
  structuredSummary?: string;
  attachmentSource?: {
    bucket?: string;
    filePath?: string;
    fileName?: string;
    fileType?: string;
  } | null;
  documentSummary?: string;
  raw?: any;
}

interface DynamicContextOptions {
  supabaseClient: any;
  companyId?: string | null;
  agentId: string;
  queries: string[];
  baseQuery: string;
  openaiApiKey?: string;
  companyMetadata?: {
    google_drive_folder_id?: string | null;
    google_drive_folder_name?: string | null;
  } | null;
}

export interface DynamicContextResult {
  tieredContext: TieredContext;
  attachmentSource?: CompanyOSBundle['attachmentSource'];
  contextUsed: boolean;
  documentSummary?: string;
}

interface AgentPromptConfig {
  displayName: string;
  personaInstructions?: string | null;
  responseStructure?: string | null;
  specialtyLabel?: string | null;
  role?: string | null;
  description?: string | null;
}

const EMPTY_CONTEXT: TieredContext = {
  companyOS: [],
  agentDocs: [],
  playbooks: [],
  keywords: [],
};

const CONTEXT_LIMITS: Record<TierName, number> = {
  companyOS: 3,
  agentDocs: 3,
  playbooks: 2,
  keywords: 2,
};

export function parseUserQuery(message: string): string {
  if (!message) return '';
  const mentionMatch = message.match(/^@[^\s]+\s+(.*)$/);
  const withoutMention = mentionMatch ? mentionMatch[1] : message;
  return withoutMention.trim();
}

export async function expandQuery(query: string, openaiApiKey?: string): Promise<{ original: string; expanded: string[] }> {
  const cleanedQuery = query?.trim() || '';
  if (!openaiApiKey || !cleanedQuery) {
    return { original: cleanedQuery, expanded: cleanedQuery ? [cleanedQuery] : [] };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: 'You expand search queries for a retrieval engine. Always respond with JSON: {"queries": ["..."]}. Include the original query and up to five semantic variations that preserve intent.'
          },
          {
            role: 'user',
            content: cleanedQuery
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Query expansion failed:', errorText);
      throw new Error('Query expansion failed');
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const normalized = rawContent.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(normalized);
    const expanded = Array.isArray(parsed?.queries) ? parsed.queries.map((q: string) => q.trim()).filter(Boolean) : [];
    const deduped = Array.from(new Set([cleanedQuery, ...expanded]));
    return { original: cleanedQuery, expanded: deduped.slice(0, 6) };
  } catch (error) {
    console.warn('Falling back to simple query list after expansion error:', error);
    const simpleVariants = [
      cleanedQuery,
      `${cleanedQuery} strategy`,
      `${cleanedQuery} plan`,
      cleanedQuery.replace(/increase/gi, 'improve'),
    ].filter(Boolean);
    return { original: cleanedQuery, expanded: Array.from(new Set(simpleVariants)).slice(0, 5) };
  }
}

function truncateContent(content: string, maxLength: number = 1600) {
  if (!content) return '';
  return content.length > maxLength ? `${content.substring(0, maxLength)}...` : content;
}

async function fetchCompanyOSBundle(supabaseClient: any, companyId: string): Promise<CompanyOSBundle> {
  const { data, error } = await supabaseClient
    .from('company_os')
    .select('os_data, raw_scraped_text, metadata')
    .eq('company_id', companyId)
    .single();

  if (error || !data?.os_data) {
    if (error) console.warn('No CompanyOS found or failed to load:', error.message);
    return { chunks: [] };
  }

  const osData = data.os_data || {};
  const core = osData.coreIdentityAndStrategicFoundation || {};
  const market = osData.customerAndMarketContext || {};
  const brand = osData.brandVoiceAndExpression || {};

  const chunks: ContextChunk[] = [];

  if (core.companyOverview || core.missionAndVision) {
    chunks.push({
      id: 'company_os_core',
      tier: 'companyOS',
      relevanceScore: 0.98,
      content: truncateContent([
        core.companyOverview,
        `Mission: ${core.missionAndVision?.missionStatement || 'N/A'}`,
        `Vision: ${core.missionAndVision?.visionStatement || 'N/A'}`,
        core.coreValues ? `Values: ${core.coreValues.join(', ')}` : null,
        core.rightToWin ? `Right to Win: ${core.rightToWin}` : null,
      ].filter(Boolean).join('\n')),
      metadata: { section: 'Core Identity', source: 'CompanyOS' }
    });
  }

  if (core.positioningStatement || market.idealCustomerProfile) {
    chunks.push({
      id: 'company_os_market',
      tier: 'companyOS',
      relevanceScore: 0.95,
      content: truncateContent([
        core.positioningStatement?.targetSegment ? `Target: ${core.positioningStatement.targetSegment}` : null,
        core.positioningStatement?.uniqueBenefit ? `Unique Benefit: ${core.positioningStatement.uniqueBenefit}` : null,
        market.idealCustomerProfile?.definingTraits ? `ICP Traits: ${market.idealCustomerProfile.definingTraits}` : null,
        market.marketAnalysis?.topDirectCompetitors?.length ? `Competitors: ${market.marketAnalysis.topDirectCompetitors.join(', ')}` : null,
      ].filter(Boolean).join('\n')),
      metadata: { section: 'Market Position', source: 'CompanyOS' }
    });
  }

  if (brand.brandPurpose || brand.brandVoiceDosAndDonts) {
    chunks.push({
      id: 'company_os_brand_voice',
      tier: 'companyOS',
      relevanceScore: 0.9,
      content: truncateContent([
        brand.brandPurpose ? `Purpose: ${brand.brandPurpose}` : null,
        brand.transformation ? `Transformation: ${brand.transformation.from || 'Current'} → ${brand.transformation.to || 'Future'}` : null,
        brand.celebrityAnalogue ? `Voice Analogue: ${brand.celebrityAnalogue}` : null,
        brand.brandVoiceDosAndDonts?.dos?.length ? `Voice Do's: ${brand.brandVoiceDosAndDonts.dos.join('; ')}` : null,
        brand.brandVoiceDosAndDonts?.donts?.length ? `Voice Don'ts: ${brand.brandVoiceDosAndDonts.donts.join('; ')}` : null,
      ].filter(Boolean).join('\n')),
      metadata: { section: 'Brand Voice', source: 'CompanyOS' }
    });
  }

  if (market.customerJourney?.topPainPoints || market.valuePropositions) {
    chunks.push({
      id: 'company_os_value_props',
      tier: 'companyOS',
      relevanceScore: 0.88,
      content: truncateContent([
        market.customerJourney?.topPainPoints?.length ? `Pain Points: ${market.customerJourney.topPainPoints.join('; ')}` : null,
        market.valuePropositions?.length ? `Value Props: ${market.valuePropositions.map((vp: any) => `${vp.clientType}: ${vp.value}`).join(' | ')}` : null,
      ].filter(Boolean).join('\n')),
      metadata: { section: 'Customer Value', source: 'CompanyOS' }
    });
  }

  if (!chunks.length && data.raw_scraped_text) {
    chunks.push({
      id: 'company_os_raw',
      tier: 'companyOS',
      relevanceScore: 0.75,
      content: truncateContent(data.raw_scraped_text),
      metadata: { section: 'Raw Document', source: 'CompanyOS Upload' }
    });
  }

  const structuredSummaryParts: string[] = [];
  if (core.keyPerformanceIndicators?.length) {
    structuredSummaryParts.push(`KPIs: ${core.keyPerformanceIndicators.map((kpi: any) => `${kpi.metric}: ${kpi.value}`).join(' | ')}`);
  }
  if (core.businessModel) {
    structuredSummaryParts.push(`Business Model: ${core.businessModel.revenueStreams?.join(', ') || ''}`.trim());
  }
  if (core.coreCompetencies?.length) {
    structuredSummaryParts.push(`Core Competencies: ${core.coreCompetencies.join(', ')}`);
  }
  if (data.metadata?.document_summary) {
    structuredSummaryParts.push(`Document Summary: ${data.metadata.document_summary}`);
  }

  return {
    chunks,
    structuredSummary: structuredSummaryParts.filter(Boolean).join('\n'),
    attachmentSource: data.metadata?.source_document || null,
    documentSummary: data.metadata?.document_summary || '',
    raw: data,
  };
}

async function searchAgentDocuments(
  supabaseClient: any,
  companyId: string,
  agentId: string,
  query: string,
  openaiApiKey?: string
): Promise<ContextChunk[]> {
  if (!openaiApiKey || !query) return [];
  try {
    const embedding = await generateQueryEmbedding(query, openaiApiKey);
    const { data, error } = await supabaseClient.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.25,
      match_count: 5,
      p_company_id: companyId,
      p_agent_id: agentId,
    });

    if (error) {
      console.error('match_documents RPC failed:', error);
      return [];
    }

    return (data || []).map((doc: any) => ({
      id: `doc_${doc.id}`,
      tier: 'agentDocs',
      relevanceScore: doc.similarity ?? 0.5,
      content: truncateContent(doc.content || ''),
      metadata: {
        source: 'Supabase Document',
        fileName: doc.file_name,
        similarity: doc.similarity?.toFixed?.(3),
      },
    }));
  } catch (error) {
    console.error('Agent document search failed:', error);
    return [];
  }
}

async function searchPlaybookSections(
  supabaseClient: any,
  companyId: string,
  queries: string[]
): Promise<ContextChunk[]> {
  const searchTerm = queries[0];
  if (!searchTerm) return [];

  const pattern = `%${searchTerm.replace(/%/g, '').replace(/'/g, "''")}%`;

  const { data, error } = await supabaseClient
    .from('playbook_sections')
    .select('id, title, content, updated_at')
    .eq('company_id', companyId)
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(4);

  if (error) {
    console.error('Playbook search failed:', error);
    return [];
  }

  return (data || []).map((section: any) => ({
    id: `playbook_${section.id}`,
    tier: 'playbooks',
    relevanceScore: 0.7,
    content: truncateContent(`${section.title}\n${section.content || ''}`),
    metadata: {
      source: 'Playbook Section',
      updatedAt: section.updated_at,
      title: section.title,
    },
  }));
}

async function keywordSearch(
  supabaseClient: any,
  companyId: string,
  queries: string[],
  companyInfo?: { google_drive_folder_id?: string | null; google_drive_folder_name?: string | null }
): Promise<ContextChunk[]> {
  const searchTerm = queries[0];
  if (!searchTerm) return [];

  const chunks: ContextChunk[] = [];
  const pattern = `%${searchTerm.replace(/%/g, '').replace(/'/g, "''")}%`;

  const { data: keywordDocs, error: keywordError } = await supabaseClient
    .from('documents')
    .select('id, content, document_archives(file_name)')
    .eq('company_id', companyId)
    .ilike('content', pattern)
    .limit(3);

  if (!keywordError && keywordDocs) {
    keywordDocs.forEach((doc: any) => {
      chunks.push({
        id: `keyword_doc_${doc.id}`,
        tier: 'keywords',
        relevanceScore: 0.55,
        content: truncateContent(doc.content || ''),
        metadata: {
          source: 'Keyword Match',
          fileName: doc.document_archives?.file_name,
        },
      });
    });
  }

  if (companyInfo?.google_drive_folder_id) {
    try {
      const searchResponse = await supabaseClient.functions.invoke('search-google-drive-files', {
        body: {
          query: searchTerm,
          folderId: companyInfo.google_drive_folder_id,
          maxResults: 5,
        }
      });

      const files = searchResponse.data?.files || [];
      const filesToFetch = files.slice(0, 2);
      const contentPromises = filesToFetch.map((file: any) =>
        supabaseClient.functions.invoke('fetch-google-drive-file-content', {
          body: {
            fileId: file.id,
            mimeType: file.mimeType,
            fileName: file.name,
          }
        }).catch(() => ({ data: null }))
      );

      const contentResults = await Promise.all(contentPromises);
      contentResults.forEach((result, idx) => {
        if (result.data?.success && result.data?.content) {
          const file = filesToFetch[idx];
          chunks.push({
            id: `google_drive_${file.id}`,
            tier: 'keywords',
            relevanceScore: 0.6,
            content: truncateContent(result.data.content),
            metadata: {
              source: 'Google Drive',
              fileName: file.name,
              link: file.webViewLink,
            },
          });
        }
      });
    } catch (error) {
      console.error('Google Drive keyword search failed:', error);
    }
  }

  return chunks;
}

async function rerankChunks(chunks: ContextChunk[], query: string): Promise<ContextChunk[]> {
  if (!query || chunks.length <= 1) return chunks;
  const apiKey = Deno.env.get('COHERE_API_KEY');
  if (!apiKey) return chunks;

  try {
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query,
        top_n: chunks.length,
        documents: chunks.map(chunk => ({ text: chunk.content || '', id: chunk.id })),
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cohere rerank error:', errorText);
      return chunks;
    }

    const data = await response.json();
    const indices = data.results?.map((result: any) => result.index).filter((index: number) => typeof index === 'number');
    if (!indices?.length) return chunks;

    const ordered = indices.map((idx: number) => chunks[idx]).filter(Boolean);
    const remaining = chunks.filter(chunk => !ordered.includes(chunk));
    return [...ordered, ...remaining];
  } catch (error) {
    console.error('Failed to rerank chunks:', error);
    return chunks;
  }
}

function structureByTier(chunks: ContextChunk[], structuredSummary?: string): TieredContext {
  const tiered: TieredContext = {
    companyOS: [],
    agentDocs: [],
    playbooks: [],
    keywords: [],
    structuredSummary,
  };

  chunks.forEach(chunk => {
    const bucket = tiered[chunk.tier];
    if (bucket && bucket.length < CONTEXT_LIMITS[chunk.tier]) {
      bucket.push(chunk);
    }
  });

  return tiered;
}

export async function buildDynamicContext(options: DynamicContextOptions): Promise<DynamicContextResult> {
  if (!options.companyId) {
    return { tieredContext: { ...EMPTY_CONTEXT }, contextUsed: false };
  }

  const companyInfoResponse = await options.supabaseClient
    .from('companies')
    .select('google_drive_folder_id, google_drive_folder_name')
    .eq('id', options.companyId)
    .single();

  const companyInfo = companyInfoResponse.data || options.companyMetadata;

  const [companyOSBundle, agentDocs, playbooks, keywords] = await Promise.all([
    fetchCompanyOSBundle(options.supabaseClient, options.companyId),
    searchAgentDocuments(options.supabaseClient, options.companyId, options.agentId, options.queries[0] || options.baseQuery, options.openaiApiKey),
    searchPlaybookSections(options.supabaseClient, options.companyId, options.queries),
    keywordSearch(options.supabaseClient, options.companyId, options.queries, companyInfo),
  ]);

  const allChunks = [...companyOSBundle.chunks, ...agentDocs, ...playbooks, ...keywords];
  const reranked = await rerankChunks(allChunks, options.baseQuery);
  const tieredContext = structureByTier(reranked, companyOSBundle.structuredSummary);

  return {
    tieredContext,
    attachmentSource: companyOSBundle.attachmentSource,
    contextUsed: reranked.length > 0,
    documentSummary: companyOSBundle.documentSummary,
  };
}

function titleCase(value?: string | null) {
  if (!value) return '';
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function renderTier(label: string, chunks: ContextChunk[]): string {
  if (!chunks?.length) {
    return `### ${label}\n_No high-priority context found for this tier._`;
  }

  const entries = chunks.map(chunk => {
    const metaParts: string[] = [];
    if (chunk.metadata?.source) metaParts.push(chunk.metadata.source);
    if (chunk.metadata?.fileName) metaParts.push(chunk.metadata.fileName);
    if (chunk.metadata?.section) metaParts.push(chunk.metadata.section);
    const metaLine = metaParts.length ? `\n_Source: ${metaParts.join(' • ')}_` : '';
    return `- ${chunk.content}${metaLine}`;
  });

  return [`### ${label}`, ...entries].join('\n');
}

export function buildAssistantPrompt(params: {
  agent: AgentPromptConfig;
  context: TieredContext;
  userQuery: string;
  toolContext?: string;
}): string {
  const personaInstructions = params.agent.personaInstructions?.trim() ||
    params.agent.description ||
    `You are ${params.agent.displayName}. Provide clear, confident answers.`;

  const specialtyLabel = params.agent.specialtyLabel || titleCase(params.agent.role || 'Role Knowledge');

  const sections: string[] = [
    `# YOU ARE: ${params.agent.displayName}`,
    personaInstructions,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '## YOUR COMPANY CONTEXT (CRITICAL — ALWAYS USE THIS)',
    renderTier('Tier 1: CompanyOS Foundation', params.context.companyOS),
    renderTier(`Tier 2: ${specialtyLabel}`, params.context.agentDocs),
    renderTier('Tier 3: Recent Team Intelligence', [...params.context.playbooks, ...params.context.keywords]),
  ];

  if (params.context.structuredSummary) {
    sections.push('### Structured Signals', params.context.structuredSummary);
  }

  sections.push(
    '## TASK',
    `The user asked: "${params.userQuery}"`,
    'Using the context above, provide a comprehensive, data-backed answer that:',
    '1. Directly addresses the request with prioritized recommendations',
    '2. References specific data points (numbers, percentages, or names) from the context when available',
    '3. Aligns with the company strategy and voice',
    '4. Explains the reasoning behind each suggestion',
    '5. Invites helpful next steps or follow-ups when appropriate'
  );

  if (params.agent.responseStructure) {
    sections.push('## RESPONSE STRUCTURE', params.agent.responseStructure);
  }

  if (params.toolContext) {
    sections.push('## LIVE TOOL OUTPUTS', params.toolContext);
  }

  sections.push('Begin your response:');
  return sections.filter(Boolean).join('\n\n');
}
