-- Modify agents table to support context injection features

-- Add new columns
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS documentation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_config_id UUID REFERENCES context_injection_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_update_context BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_context_update TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agents_context_config_id ON agents(context_config_id);
CREATE INDEX IF NOT EXISTS idx_agents_documentation_count ON agents(documentation_count);

-- Update RLS policies for agents to account for consultant management

-- Drop old policies if they conflict
DROP POLICY IF EXISTS "Users can view agents from their company" ON agents;
DROP POLICY IF EXISTS "Admins can create agents" ON agents;
DROP POLICY IF EXISTS "Admins can update agents" ON agents;
DROP POLICY IF EXISTS "Admins can delete agents" ON agents;

-- Users can view agents from their own company or companies they manage
CREATE POLICY "Users can view agents from their company or managed companies"
  ON agents
  FOR SELECT
  USING (
    -- User belongs to this company
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- User manages this company as consultant
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
    OR
    -- Default agents (templates) are visible to consultants and platform admins
    (
      is_default = TRUE
      AND company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('platform-admin', 'consultant')
      )
    )
  );

-- Only consultants and platform admins can create agents
CREATE POLICY "Consultants can create agents"
  ON agents
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
    OR
    -- Special case: creating default agents (templates)
    (
      is_default = TRUE
      AND company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform-admin'
      )
    )
  );

-- Only consultants and platform admins can update agents
CREATE POLICY "Consultants can update agents"
  ON agents
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

-- Only consultants and platform admins can delete agents
CREATE POLICY "Consultants can delete agents"
  ON agents
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

-- Trigger to update documentation count when agent_documents change
CREATE OR REPLACE FUNCTION update_agent_documentation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agents
    SET documentation_count = documentation_count + 1,
        last_context_update = NOW()
    WHERE id = NEW.agent_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agents
    SET documentation_count = GREATEST(0, documentation_count - 1),
        last_context_update = NOW()
    WHERE id = OLD.agent_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_count_insert
  AFTER INSERT ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documentation_count();

CREATE TRIGGER agent_documents_count_delete
  AFTER DELETE ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documentation_count();

-- Function to sync context_config_id when context config is created
CREATE OR REPLACE FUNCTION sync_agent_context_config_id()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agents
  SET context_config_id = NEW.id,
      last_context_update = NOW()
  WHERE id = NEW.agent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_config_sync_to_agent
  AFTER INSERT ON context_injection_config
  FOR EACH ROW
  EXECUTE FUNCTION sync_agent_context_config_id();

-- Function to recalculate documentation count (for data consistency)
CREATE OR REPLACE FUNCTION recalculate_agent_documentation_count(p_agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count
  FROM agent_documents
  WHERE agent_id = p_agent_id;

  UPDATE agents
  SET documentation_count = doc_count,
      last_context_update = NOW()
  WHERE id = p_agent_id;

  RETURN doc_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN agents.documentation_count IS 'Number of agent_documents associated with this agent';
COMMENT ON COLUMN agents.context_config_id IS 'FK to context_injection_config for this agent';
COMMENT ON COLUMN agents.auto_update_context IS 'Whether to automatically update context when documents are added/removed';
COMMENT ON COLUMN agents.last_context_update IS 'Last time agent context (docs or config) was updated';
COMMENT ON FUNCTION recalculate_agent_documentation_count IS 'Recalculates and updates the documentation_count for an agent';
