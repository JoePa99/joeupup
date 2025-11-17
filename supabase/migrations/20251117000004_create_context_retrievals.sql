-- Create context_retrievals table
-- Logs all context retrieval operations for analytics, debugging, and quality monitoring
-- Tracks what context was retrieved for each user query

CREATE TABLE IF NOT EXISTS context_retrievals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Query information
  original_query TEXT NOT NULL,
  expanded_queries TEXT[],

  -- Retrieved context (stored as JSONB for flexibility)
  -- Each entry: {id, content, source, score, metadata}
  company_os_chunks JSONB DEFAULT '[]'::jsonb,
  agent_doc_chunks JSONB DEFAULT '[]'::jsonb,
  playbook_chunks JSONB DEFAULT '[]'::jsonb,
  shared_doc_chunks JSONB DEFAULT '[]'::jsonb,
  keyword_matches JSONB DEFAULT '[]'::jsonb,
  structured_data JSONB DEFAULT '{}'::jsonb,

  -- Performance metrics (in milliseconds)
  retrieval_time_ms INTEGER,
  rerank_time_ms INTEGER,
  total_time_ms INTEGER,

  -- Quality metrics
  context_confidence_score NUMERIC(3,2) CHECK (context_confidence_score >= 0 AND context_confidence_score <= 1),
  sources_used INTEGER DEFAULT 0,
  chunks_retrieved INTEGER DEFAULT 0,
  chunks_used_in_prompt INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_context_retrievals_agent_id ON context_retrievals(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_company_id ON context_retrievals(company_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_conversation_id ON context_retrievals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_created_at ON context_retrievals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_confidence_score ON context_retrievals(context_confidence_score);

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_context_retrievals_company_os_chunks ON context_retrievals USING GIN(company_os_chunks);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_agent_doc_chunks ON context_retrievals USING GIN(agent_doc_chunks);

-- Enable RLS
ALTER TABLE context_retrievals ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view context retrievals from their own company
CREATE POLICY "Users can view context retrievals from their company"
  ON context_retrievals
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

-- System can insert context retrievals (no user restriction)
CREATE POLICY "System can insert context retrievals"
  ON context_retrievals
  FOR INSERT
  WITH CHECK (true);

-- Only platform admins can delete old retrieval logs
CREATE POLICY "Platform admins can delete context retrievals"
  ON context_retrievals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Function to calculate context confidence score
-- Based on average relevance scores of retrieved chunks
CREATE OR REPLACE FUNCTION calculate_context_confidence(
  company_os_chunks JSONB,
  agent_doc_chunks JSONB,
  playbook_chunks JSONB,
  shared_doc_chunks JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  all_scores NUMERIC[];
  avg_score NUMERIC;
BEGIN
  -- Extract all scores from chunks
  SELECT ARRAY(
    SELECT (value->>'score')::numeric
    FROM (
      SELECT jsonb_array_elements(company_os_chunks) AS value
      UNION ALL
      SELECT jsonb_array_elements(agent_doc_chunks)
      UNION ALL
      SELECT jsonb_array_elements(playbook_chunks)
      UNION ALL
      SELECT jsonb_array_elements(shared_doc_chunks)
    ) AS all_chunks
    WHERE value->>'score' IS NOT NULL
  ) INTO all_scores;

  -- Calculate average
  IF array_length(all_scores, 1) IS NULL OR array_length(all_scores, 1) = 0 THEN
    RETURN 0.0;
  END IF;

  SELECT AVG(score) INTO avg_score FROM unnest(all_scores) AS score;

  RETURN ROUND(avg_score, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate metrics before insert
CREATE OR REPLACE FUNCTION update_context_retrieval_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate confidence score if not provided
  IF NEW.context_confidence_score IS NULL THEN
    NEW.context_confidence_score = calculate_context_confidence(
      NEW.company_os_chunks,
      NEW.agent_doc_chunks,
      NEW.playbook_chunks,
      NEW.shared_doc_chunks
    );
  END IF;

  -- Count sources used
  NEW.sources_used = 0;
  IF jsonb_array_length(NEW.company_os_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.agent_doc_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.playbook_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.shared_doc_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.keyword_matches) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;

  -- Count total chunks retrieved
  NEW.chunks_retrieved = (
    COALESCE(jsonb_array_length(NEW.company_os_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.agent_doc_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.playbook_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.shared_doc_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.keyword_matches), 0)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_retrieval_metrics
  BEFORE INSERT ON context_retrievals
  FOR EACH ROW
  EXECUTE FUNCTION update_context_retrieval_metrics();

-- Create a view for easy analytics
CREATE OR REPLACE VIEW context_retrieval_analytics AS
SELECT
  agent_id,
  company_id,
  DATE(created_at) AS retrieval_date,
  COUNT(*) AS total_retrievals,
  AVG(context_confidence_score) AS avg_confidence,
  AVG(total_time_ms) AS avg_total_time_ms,
  AVG(chunks_retrieved) AS avg_chunks_retrieved,
  AVG(sources_used) AS avg_sources_used,
  COUNT(*) FILTER (WHERE context_confidence_score < 0.7) AS low_confidence_count,
  COUNT(*) FILTER (WHERE total_time_ms > 2000) AS slow_retrievals
FROM context_retrievals
GROUP BY agent_id, company_id, DATE(created_at);

COMMENT ON TABLE context_retrievals IS 'Logs all context retrieval operations for debugging and quality monitoring';
COMMENT ON COLUMN context_retrievals.context_confidence_score IS 'Average relevance score of retrieved chunks (0-1)';
COMMENT ON COLUMN context_retrievals.chunks_used_in_prompt IS 'Number of chunks actually included in the final prompt (after reranking)';
