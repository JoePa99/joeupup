-- Create agent_documents table
-- Stores agent-specific documentation with vector embeddings for RAG
-- Unlike the 'documents' table, these are tied to specific agents

CREATE TABLE IF NOT EXISTS agent_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Document metadata
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'pdf', 'text', 'url', 'html')),

  -- Source tracking
  source_url TEXT,
  source_file_name TEXT,
  source_file_path TEXT,  -- Supabase storage path if uploaded

  -- Vector embedding for semantic search
  embedding vector(1536),  -- OpenAI text-embedding-ada-002 or text-embedding-3-small

  -- Chunking support (for large documents)
  chunk_index INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  word_count INTEGER,
  estimated_read_time INTEGER,  -- in minutes
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Access control
  created_by UUID REFERENCES profiles(id),
  uploaded_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_id ON agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_company_id ON agent_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_content_type ON agent_documents(content_type);
CREATE INDEX IF NOT EXISTS idx_agent_documents_tags ON agent_documents USING GIN(tags);

-- Vector similarity search index (IVFFlat)
-- Note: Adjust 'lists' parameter based on dataset size (rule of thumb: rows / 1000)
CREATE INDEX IF NOT EXISTS idx_agent_documents_embedding
  ON agent_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Enable RLS
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view agent documents from their own company
CREATE POLICY "Users can view agent documents from their company"
  ON agent_documents
  FOR SELECT
  USING (
    -- User belongs to this company
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

-- Only consultants and platform admins can create agent documents
CREATE POLICY "Consultants can create agent documents"
  ON agent_documents
  FOR INSERT
  WITH CHECK (
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can create anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can update agent documents
CREATE POLICY "Consultants can update agent documents"
  ON agent_documents
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

-- Only consultants and platform admins can delete agent documents
CREATE POLICY "Consultants can delete agent documents"
  ON agent_documents
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
CREATE OR REPLACE FUNCTION update_agent_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_updated_at
  BEFORE UPDATE ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documents_updated_at();

-- Trigger to update word count and estimated read time
CREATE OR REPLACE FUNCTION update_agent_documents_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate word count (rough estimate: split on whitespace)
  NEW.word_count = array_length(regexp_split_to_array(NEW.content, '\s+'), 1);

  -- Estimated read time: 200 words per minute
  NEW.estimated_read_time = GREATEST(1, CEIL(NEW.word_count::numeric / 200));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_metadata
  BEFORE INSERT OR UPDATE OF content ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documents_metadata();

COMMENT ON TABLE agent_documents IS 'Agent-specific documentation with vector embeddings for RAG retrieval. Each document is tied to a specific agent.';
COMMENT ON COLUMN agent_documents.embedding IS 'Vector embedding (1536 dimensions) for semantic search using OpenAI text-embedding-ada-002';
COMMENT ON COLUMN agent_documents.chunk_index IS 'For large documents split into chunks: 0-based index of this chunk';
COMMENT ON COLUMN agent_documents.total_chunks IS 'Total number of chunks for this document';
