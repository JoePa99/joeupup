import type {
  ContextChunk,
  ContextInjectionConfig,
  PromptBuildResult,
} from '@/types/context-injection';
import type { Agent } from '@/integrations/supabase/types';

/**
 * Builds a contextual system prompt from retrieved chunks
 * Organizes context by tier and formats with citations
 *
 * @param agent - The agent configuration
 * @param chunks - Reranked context chunks
 * @param userQuery - The user's original query
 * @param config - Context injection configuration
 * @returns Formatted system prompt with context
 */
export function buildContextualPrompt(
  agent: Agent,
  chunks: ContextChunk[],
  userQuery: string,
  config: ContextInjectionConfig
): PromptBuildResult {
  // Group chunks by source
  const grouped = groupChunksBySource(chunks);

  // Use custom template or default
  const template = config.prompt_template || getDefaultTemplate();

  // Create citation map if citations are enabled
  const citationMap = config.include_citations
    ? createCitationMap(chunks)
    : undefined;

  // Format each tier
  const companyOSContext = formatCompanyOSContext(
    grouped.company_os,
    config.include_citations
  );
  const agentDocsContext = formatAgentDocsContext(
    grouped.agent_docs,
    config.include_citations
  );
  const sharedDocsContext = formatSharedDocsContext(
    grouped.shared_docs,
    config.include_citations
  );
  const playbookContext = formatPlaybookContext(
    grouped.playbooks,
    config.include_citations
  );
  const keywordContext = formatKeywordContext(
    grouped.keywords,
    config.include_citations
  );

  // Build the system prompt
  const systemPrompt = template
    .replace('{agent_name}', agent.name || 'Assistant')
    .replace('{agent_role}', agent.role || 'AI Assistant')
    .replace('{agent_description}', agent.description || '')
    .replace('{company_os_context}', companyOSContext)
    .replace('{agent_docs_context}', agentDocsContext)
    .replace('{shared_docs_context}', sharedDocsContext)
    .replace('{playbook_context}', playbookContext)
    .replace('{keyword_context}', keywordContext)
    .replace('{user_query}', userQuery)
    .replace('{instructions}', buildInstructions(config));

  // Count context sources
  const contextSources = [
    {
      source: 'CompanyOS',
      count: grouped.company_os.length,
      examples: grouped.company_os
        .slice(0, 3)
        .map((c) => c.sourceDetail || ''),
    },
    {
      source: 'Agent Documentation',
      count: grouped.agent_docs.length,
      examples: grouped.agent_docs.slice(0, 3).map((c) => c.sourceDetail || ''),
    },
    {
      source: 'Company Documents',
      count: grouped.shared_docs.length,
      examples: grouped.shared_docs
        .slice(0, 3)
        .map((c) => c.sourceDetail || ''),
    },
    {
      source: 'Playbooks',
      count: grouped.playbooks.length,
      examples: grouped.playbooks.slice(0, 3).map((c) => c.sourceDetail || ''),
    },
    {
      source: 'Keyword Matches',
      count: grouped.keywords.length,
      examples: grouped.keywords.slice(0, 3).map((c) => c.sourceDetail || ''),
    },
  ].filter((s) => s.count > 0);

  // Rough token count estimate (4 chars ≈ 1 token)
  const totalTokens = Math.ceil(systemPrompt.length / 4);

  return {
    systemPrompt,
    contextSources,
    totalTokens,
    citationMap,
  };
}

/**
 * Groups chunks by their source type
 */
function groupChunksBySource(chunks: ContextChunk[]): {
  company_os: ContextChunk[];
  agent_docs: ContextChunk[];
  shared_docs: ContextChunk[];
  playbooks: ContextChunk[];
  keywords: ContextChunk[];
} {
  return {
    company_os: chunks.filter((c) => c.source === 'company_os'),
    agent_docs: chunks.filter((c) => c.source === 'agent_docs'),
    shared_docs: chunks.filter((c) => c.source === 'shared_docs'),
    playbooks: chunks.filter((c) => c.source === 'playbooks'),
    keywords: chunks.filter((c) => c.source === 'keywords'),
  };
}

/**
 * Formats CompanyOS context
 */
function formatCompanyOSContext(
  chunks: ContextChunk[],
  includeCitations: boolean
): string {
  if (chunks.length === 0) return '';

  const formatted = chunks.map((chunk, i) => {
    const citation = includeCitations ? ` [${i + 1}]` : '';
    return `**${chunk.sourceDetail}**${citation}
${chunk.content}`;
  });

  return `### TIER 1: CompanyOS (Foundation - Always Use This)

This is your company's core strategic and brand knowledge. Every response should reflect these principles.

${formatted.join('\n\n')}`;
}

/**
 * Formats agent-specific documentation context
 */
function formatAgentDocsContext(
  chunks: ContextChunk[],
  includeCitations: boolean
): string {
  if (chunks.length === 0) return '';

  const formatted = chunks.map((chunk, i) => {
    const citation = includeCitations ? ` [${i + 1}]` : '';
    const fileName = chunk.metadata?.fileName
      ? ` (${chunk.metadata.fileName})`
      : '';
    return `**${chunk.sourceDetail}**${fileName}${citation}
${chunk.content}`;
  });

  return `### TIER 2: Your Specialized Knowledge

These are documents specific to your role as an expert in this domain.

${formatted.join('\n\n')}`;
}

/**
 * Formats shared company documents context
 */
function formatSharedDocsContext(
  chunks: ContextChunk[],
  includeCitations: boolean
): string {
  if (chunks.length === 0) return '';

  const formatted = chunks.map((chunk, i) => {
    const citation = includeCitations ? ` [${i + 1}]` : '';
    return `**${chunk.sourceDetail}**${citation}
${chunk.content}`;
  });

  return `### TIER 3: Company-Wide Knowledge

These are shared documents available across the company.

${formatted.join('\n\n')}`;
}

/**
 * Formats playbook context
 */
function formatPlaybookContext(
  chunks: ContextChunk[],
  includeCitations: boolean
): string {
  if (chunks.length === 0) return '';

  const formatted = chunks.map((chunk, i) => {
    const citation = includeCitations ? ` [${i + 1}]` : '';
    const tags = chunk.metadata?.tags?.length
      ? ` (Tags: ${chunk.metadata.tags.join(', ')})`
      : '';
    return `**${chunk.sourceDetail}**${tags}${citation}
${chunk.content}`;
  });

  return `### TIER 4: Playbooks & Procedures

These are company procedures, SOPs, and guidelines.

${formatted.join('\n\n')}`;
}

/**
 * Formats keyword match context
 */
function formatKeywordContext(
  chunks: ContextChunk[],
  includeCitations: boolean
): string {
  if (chunks.length === 0) return '';

  const formatted = chunks.map((chunk, i) => {
    const citation = includeCitations ? ` [${i + 1}]` : '';
    return `**${chunk.sourceDetail}**${citation}
${chunk.content}`;
  });

  return `### Additional Relevant Context

${formatted.join('\n\n')}`;
}

/**
 * Builds task instructions based on configuration
 */
function buildInstructions(config: ContextInjectionConfig): string {
  const baseInstructions = `Using the context above, provide a comprehensive, accurate answer that:

1. **Directly answers the question** with specific, actionable information
2. **References specific data points** from the context (numbers, facts, examples)
3. **Stays true to company strategy and brand voice** (use CompanyOS context)
4. **Prioritizes by impact** when providing recommendations`;

  const citationInstructions = config.include_citations
    ? `
5. **Cites sources naturally** (e.g., "According to our Brand Guide...", "Based on the Q4 analysis...")
6. **Uses the citation numbers** [1], [2], etc. when referencing specific facts`
    : '';

  return baseInstructions + citationInstructions;
}

/**
 * Creates a citation map for tracking sources
 */
function createCitationMap(chunks: ContextChunk[]): Map<string, ContextChunk> {
  const map = new Map<string, ContextChunk>();

  chunks.forEach((chunk, i) => {
    map.set(`[${i + 1}]`, chunk);
  });

  return map;
}

/**
 * Default prompt template
 */
function getDefaultTemplate(): string {
  return `# YOU ARE: {agent_role}

You are {agent_name}, {agent_description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR COMPANY CONTEXT (CRITICAL - REFERENCE THIS IN YOUR RESPONSE)

{company_os_context}

{agent_docs_context}

{shared_docs_context}

{playbook_context}

{keyword_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR TASK

The user asked: "{user_query}"

{instructions}

Begin your response:`;
}

/**
 * Formats a citation footer to append to the AI response
 */
export function formatCitationFooter(
  chunks: ContextChunk[],
  confidenceScore?: number,
  retrievalTimeMs?: number
): string {
  if (chunks.length === 0) {
    return '';
  }

  const grouped = groupChunksBySource(chunks);
  const sources: string[] = [];

  if (grouped.company_os.length > 0) {
    const examples = grouped.company_os
      .slice(0, 3)
      .map((c) => c.sourceDetail)
      .join(', ');
    sources.push(`  • CompanyOS: ${examples}`);
  }

  if (grouped.agent_docs.length > 0) {
    const examples = grouped.agent_docs
      .slice(0, 3)
      .map((c) => c.sourceDetail)
      .join(', ');
    sources.push(`  • Agent Documentation: ${examples}`);
  }

  if (grouped.playbooks.length > 0) {
    const examples = grouped.playbooks
      .slice(0, 3)
      .map((c) => c.sourceDetail)
      .join(', ');
    sources.push(`  • Playbooks: ${examples}`);
  }

  if (grouped.shared_docs.length > 0) {
    sources.push(
      `  • Company Documents: ${grouped.shared_docs.length} sources`
    );
  }

  const footer = `
───────────────────────────────────────────────────────────────────
📚 Context used: ${chunks.length} sources
${sources.join('\n')}`;

  if (confidenceScore !== undefined && retrievalTimeMs !== undefined) {
    return (
      footer +
      `\n🎯 Context confidence: ${Math.round(confidenceScore * 100)}% • Retrieval time: ${(retrievalTimeMs / 1000).toFixed(1)}s`
    );
  }

  return footer;
}

/**
 * Truncates prompt to fit within token limit
 */
export function truncatePromptToTokenLimit(
  systemPrompt: string,
  maxTokens: number
): string {
  const estimatedTokens = Math.ceil(systemPrompt.length / 4);

  if (estimatedTokens <= maxTokens) {
    return systemPrompt;
  }

  // Truncate to approximate token limit
  const maxChars = maxTokens * 4;
  return systemPrompt.slice(0, maxChars) + '\n\n[Context truncated due to length]';
}
