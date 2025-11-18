-- Create context_injection_config table
-- Per-agent configuration for context retrieval and prompt assembly
-- Allows consultants to fine-tune how context is retrieved and used

CREATE TABLE IF NOT EXISTS context_injection_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Enable/disable each context tier
  enable_company_os BOOLEAN DEFAULT TRUE,
  enable_agent_docs BOOLEAN DEFAULT TRUE,
  enable_playbooks BOOLEAN DEFAULT TRUE,
  enable_shared_docs BOOLEAN DEFAULT TRUE,
  enable_keyword_search BOOLEAN DEFAULT TRUE,
  enable_structured_data BOOLEAN DEFAULT FALSE,

  -- Retrieval parameters
  max_chunks_per_source INTEGER DEFAULT 3 CHECK (max_chunks_per_source >= 1 AND max_chunks_per_source <= 10),
  total_max_chunks INTEGER DEFAULT 10 CHECK (total_max_chunks >= 1 AND total_max_chunks <= 20),
  similarity_threshold NUMERIC(3,2) DEFAULT 0.70 CHECK (similarity_threshold >= 0 AND similarity_threshold <= 1),

  -- Query expansion settings
  enable_query_expansion BOOLEAN DEFAULT TRUE,
  max_expanded_queries INTEGER DEFAULT 5 CHECK (max_expanded_queries >= 1 AND max_expanded_queries <= 10),

  -- Reranking settings
  enable_reranking BOOLEAN DEFAULT TRUE,
  rerank_model TEXT DEFAULT 'cohere-rerank-v3',
  rerank_top_n INTEGER DEFAULT 8 CHECK (rerank_top_n >= 1 AND rerank_top_n <= 20),

  -- Prompt assembly settings
  prompt_template TEXT,  -- Custom Jinja2-style template (optional)
  include_citations BOOLEAN DEFAULT TRUE,
  citation_format TEXT DEFAULT 'footnote' CHECK (citation_format IN ('footnote', 'inline', 'none')),
  max_context_tokens INTEGER DEFAULT 8000 CHECK (max_context_tokens >= 1000 AND max_context_tokens <= 32000),

  -- Advanced settings
  company_os_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (company_os_weight >= 0 AND company_os_weight <= 2),
  agent_docs_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (agent_docs_weight >= 0 AND agent_docs_weight <= 2),
  playbooks_weight NUMERIC(3,2) DEFAULT 0.8 CHECK (playbooks_weight >= 0 AND playbooks_weight <= 2),
  shared_docs_weight NUMERIC(3,2) DEFAULT 0.8 CHECK (shared_docs_weight >= 0 AND shared_docs_weight <= 2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_context_injection_config_agent_id ON context_injection_config(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_injection_config_company_id ON context_injection_config(company_id);

-- Enable RLS
ALTER TABLE context_injection_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view configs from their own company
CREATE POLICY "Users can view context configs from their company"
  ON context_injection_config
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can create configs
CREATE POLICY "Consultants can create context configs"
  ON context_injection_config
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can update configs
CREATE POLICY "Consultants can update context configs"
  ON context_injection_config
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can delete configs
CREATE POLICY "Consultants can delete context configs"
  ON context_injection_config
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_context_injection_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_injection_config_updated_at
  BEFORE UPDATE ON context_injection_config
  FOR EACH ROW
  EXECUTE FUNCTION update_context_injection_config_updated_at();

-- Function to create default config when agent is created
CREATE OR REPLACE FUNCTION create_default_context_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default context config for new agent
  INSERT INTO context_injection_config (
    agent_id,
    company_id,
    enable_company_os,
    enable_agent_docs,
    enable_playbooks,
    enable_shared_docs,
    enable_keyword_search,
    enable_structured_data,
    max_chunks_per_source,
    total_max_chunks,
    similarity_threshold,
    enable_query_expansion,
    max_expanded_queries,
    enable_reranking,
    rerank_model,
    rerank_top_n,
    include_citations,
    citation_format,
    max_context_tokens
  )
  VALUES (
    NEW.id,
    NEW.company_id,
    TRUE,   -- enable_company_os
    TRUE,   -- enable_agent_docs
    TRUE,   -- enable_playbooks
    TRUE,   -- enable_shared_docs
    TRUE,   -- enable_keyword_search
    FALSE,  -- enable_structured_data
    3,      -- max_chunks_per_source
    10,     -- total_max_chunks
    0.70,   -- similarity_threshold
    TRUE,   -- enable_query_expansion
    5,      -- max_expanded_queries
    TRUE,   -- enable_reranking
    'cohere-rerank-v3',  -- rerank_model
    8,      -- rerank_top_n
    TRUE,   -- include_citations
    'footnote',  -- citation_format
    8000    -- max_context_tokens
  )
  ON CONFLICT (agent_id) DO NOTHING;  -- Avoid duplicate if already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to agents table
CREATE TRIGGER agent_create_context_config
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION create_default_context_config();

-- Helper function to get config with fallback to defaults
CREATE OR REPLACE FUNCTION get_context_config(p_agent_id UUID)
RETURNS context_injection_config AS $$
DECLARE
  config context_injection_config;
BEGIN
  SELECT * INTO config
  FROM context_injection_config
  WHERE agent_id = p_agent_id;

  -- If no config exists, return default
  IF NOT FOUND THEN
    SELECT
      gen_random_uuid() AS id,
      p_agent_id AS agent_id,
      NULL::UUID AS company_id,
      TRUE AS enable_company_os,
      TRUE AS enable_agent_docs,
      TRUE AS enable_playbooks,
      TRUE AS enable_shared_docs,
      TRUE AS enable_keyword_search,
      FALSE AS enable_structured_data,
      3 AS max_chunks_per_source,
      10 AS total_max_chunks,
      0.70 AS similarity_threshold,
      TRUE AS enable_query_expansion,
      5 AS max_expanded_queries,
      TRUE AS enable_reranking,
      'cohere-rerank-v3' AS rerank_model,
      8 AS rerank_top_n,
      NULL AS prompt_template,
      TRUE AS include_citations,
      'footnote' AS citation_format,
      8000 AS max_context_tokens,
      1.0 AS company_os_weight,
      1.0 AS agent_docs_weight,
      0.8 AS playbooks_weight,
      0.8 AS shared_docs_weight,
      NOW() AS created_at,
      NOW() AS updated_at
    INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE context_injection_config IS 'Per-agent configuration for context retrieval and prompt assembly';
COMMENT ON COLUMN context_injection_config.similarity_threshold IS 'Minimum cosine similarity score (0-1) to include a chunk';
COMMENT ON COLUMN context_injection_config.company_os_weight IS 'Weight multiplier for CompanyOS chunks during reranking (0-2)';
COMMENT ON COLUMN context_injection_config.prompt_template IS 'Custom Jinja2-style template for prompt assembly (optional, falls back to default)';
COMMENT ON FUNCTION create_default_context_config IS 'Automatically creates default context config when new agent is created';
COMMENT ON FUNCTION get_context_config IS 'Retrieves context config for agent, returns defaults if not found';
