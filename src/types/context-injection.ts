// TypeScript types for the context injection system

// ============================================================================
// Database Table Types
// ============================================================================

export interface ConsultantWorkspace {
  id: string;
  consultant_id: string;
  company_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface AgentDocument {
  id: string;
  agent_id: string;
  company_id: string;
  title: string;
  content: string;
  content_type: 'markdown' | 'pdf' | 'text' | 'url' | 'html';
  source_url?: string | null;
  source_file_name?: string | null;
  source_file_path?: string | null;
  embedding?: number[] | null;
  chunk_index: number;
  total_chunks: number;
  word_count?: number | null;
  estimated_read_time?: number | null;
  tags?: string[] | null;
  metadata?: Record<string, any> | null;
  created_by?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContextInjectionConfig {
  id: string;
  agent_id: string;
  company_id: string;

  // Enable/disable each tier
  enable_company_os: boolean;
  enable_agent_docs: boolean;
  enable_playbooks: boolean;
  enable_shared_docs: boolean;
  enable_keyword_search: boolean;
  enable_structured_data: boolean;

  // Retrieval parameters
  max_chunks_per_source: number;
  total_max_chunks: number;
  similarity_threshold: number;

  // Query expansion
  enable_query_expansion: boolean;
  max_expanded_queries: number;

  // Reranking
  enable_reranking: boolean;
  rerank_model: string;
  rerank_top_n: number;

  // Prompt assembly
  prompt_template?: string | null;
  include_citations: boolean;
  citation_format: 'footnote' | 'inline' | 'none';
  max_context_tokens: number;

  // Weights
  company_os_weight: number;
  agent_docs_weight: number;
  playbooks_weight: number;
  shared_docs_weight: number;

  created_at: string;
  updated_at: string;
}

export interface ContextRetrieval {
  id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  agent_id: string;
  company_id: string;

  // Query info
  original_query: string;
  expanded_queries?: string[] | null;

  // Retrieved context
  company_os_chunks?: ContextChunk[] | null;
  agent_doc_chunks?: ContextChunk[] | null;
  playbook_chunks?: ContextChunk[] | null;
  shared_doc_chunks?: ContextChunk[] | null;
  keyword_matches?: ContextChunk[] | null;
  structured_data?: Record<string, any> | null;

  // Performance metrics
  retrieval_time_ms?: number | null;
  rerank_time_ms?: number | null;
  total_time_ms?: number | null;

  // Quality metrics
  context_confidence_score?: number | null;
  sources_used?: number | null;
  chunks_retrieved?: number | null;
  chunks_used_in_prompt?: number | null;

  created_at: string;
}

export interface QueryExpansionCache {
  id: string;
  original_query: string;
  query_hash: string;
  expanded_queries: string[];
  expansion_model: string;
  hit_count: number;
  last_used_at: string;
  created_at: string;
  expires_at: string;
}

// ============================================================================
// Context Retrieval Types
// ============================================================================

export interface ContextChunk {
  id: string;
  content: string;
  source: 'company_os' | 'agent_docs' | 'shared_docs' | 'playbooks' | 'keywords';
  sourceDetail?: string; // e.g., "Brand Guide p.34", "Financial Analysis Framework"
  score: number; // Similarity or relevance score
  rerankScore?: number; // Score after reranking
  metadata?: {
    section?: string;
    fileName?: string;
    uploadedAt?: string;
    chunkIndex?: number;
    page?: number;
    [key: string]: any;
  };
}

export interface RetrievalResult {
  companyOS: ContextChunk[];
  agentDocs: ContextChunk[];
  sharedDocs: ContextChunk[];
  playbooks: ContextChunk[];
  keywords: ContextChunk[];
  retrievalTimeMs: number;
  totalChunks: number;
}

export interface RerankResult {
  chunks: ContextChunk[];
  rerankTimeMs: number;
}

// ============================================================================
// Query Expansion Types
// ============================================================================

export interface QueryExpansionOptions {
  maxExpansions?: number;
  useCache?: boolean;
  model?: string;
}

export interface QueryExpansionResult {
  originalQuery: string;
  expandedQueries: string[];
  fromCache: boolean;
  expansionTimeMs?: number;
}

// ============================================================================
// Prompt Building Types
// ============================================================================

export interface PromptBuildResult {
  systemPrompt: string;
  contextSources: {
    source: string;
    count: number;
    examples: string[];
  }[];
  totalTokens: number;
  citationMap?: Map<string, ContextChunk>;
}

export interface CitationFormat {
  format: 'footnote' | 'inline' | 'none';
  style?: 'numbered' | 'lettered';
}

// ============================================================================
// Client Permissions Types
// ============================================================================

export interface ClientPermissions {
  can_create_agents: boolean;
  can_edit_company_os: boolean;
  can_upload_documents: boolean;
  can_create_playbooks: boolean;
  can_contribute_to_playbooks: boolean;
  can_invite_users: boolean;
  can_view_analytics: boolean;
  can_edit_profile: boolean;
  can_view_agents: boolean;
  can_chat_with_agents: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateClientWorkspaceRequest {
  company_name: string;
  company_domain?: string;
  primary_contact_email?: string;
  primary_contact_first_name?: string;
  primary_contact_last_name?: string;
  client_permissions?: Partial<ClientPermissions>;
}

export interface CreateClientWorkspaceResponse {
  company_id: string;
  invitation_id?: string;
  invitation_token?: string;
}

export interface UploadAgentDocumentRequest {
  agent_id: string;
  title: string;
  content: string;
  content_type: 'markdown' | 'pdf' | 'text' | 'url' | 'html';
  source_url?: string;
  source_file_name?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ChatWithContextRequest {
  agent_id: string;
  company_id: string;
  message: string;
  conversation_id?: string;
  user_id: string;
}

export interface ChatWithContextResponse {
  message_id: string;
  conversation_id: string;
  response: string;
  context_retrieval_id?: string;
  context_confidence?: number;
  sources_used?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ContextSource = 'company_os' | 'agent_docs' | 'shared_docs' | 'playbooks' | 'keywords' | 'structured_data';

export interface ContextSourceConfig {
  enabled: boolean;
  weight: number;
  maxChunks: number;
}

export interface VectorSearchParams {
  embedding: number[];
  threshold: number;
  limit: number;
}

export interface KeywordSearchParams {
  query: string;
  limit: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ContextRetrievalAnalytics {
  agent_id: string;
  company_id: string;
  retrieval_date: string;
  total_retrievals: number;
  avg_confidence: number;
  avg_total_time_ms: number;
  avg_chunks_retrieved: number;
  avg_sources_used: number;
  low_confidence_count: number;
  slow_retrievals: number;
}

export interface AgentDocumentUploadProgress {
  total: number;
  processed: number;
  failed: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
