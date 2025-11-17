-- Modify onboarding_sessions table to support consultant-managed onboarding

-- Add new columns
ALTER TABLE onboarding_sessions
  ADD COLUMN IF NOT EXISTS invited_by_consultant UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS workspace_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS skip_company_os_creation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS skip_agent_creation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invitation_token TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_invited_by_consultant ON onboarding_sessions(invited_by_consultant);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_workspace_ready ON onboarding_sessions(workspace_ready);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_invitation_token ON onboarding_sessions(invitation_token);

-- Function to check if workspace is ready for client access
CREATE OR REPLACE FUNCTION check_workspace_ready(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_company_os BOOLEAN;
  has_agents BOOLEAN;
BEGIN
  -- Check if CompanyOS exists and is completed
  SELECT EXISTS (
    SELECT 1 FROM company_os
    WHERE company_id = p_company_id
    AND status = 'completed'
  ) INTO has_company_os;

  -- Check if at least one active agent exists
  SELECT EXISTS (
    SELECT 1 FROM agents
    WHERE company_id = p_company_id
    AND status = 'active'
  ) INTO has_agents;

  RETURN has_company_os AND has_agents;
END;
$$ LANGUAGE plpgsql;

-- Function to mark workspace as ready
CREATE OR REPLACE FUNCTION mark_workspace_ready(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_ready BOOLEAN;
BEGIN
  is_ready := check_workspace_ready(p_company_id);

  -- Update all onboarding sessions for this company
  UPDATE onboarding_sessions
  SET workspace_ready = is_ready,
      updated_at = NOW()
  WHERE company_id = p_company_id;

  RETURN is_ready;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update workspace_ready when CompanyOS is completed
CREATE OR REPLACE FUNCTION auto_mark_workspace_ready()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM mark_workspace_ready(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_os_completed_mark_workspace_ready
  AFTER INSERT OR UPDATE OF status ON company_os
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_workspace_ready();

-- Trigger to auto-update workspace_ready when agent is created
CREATE OR REPLACE FUNCTION auto_mark_workspace_ready_on_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Check when active agent is created
  IF NEW.status = 'active' THEN
    PERFORM mark_workspace_ready(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_created_mark_workspace_ready
  AFTER INSERT OR UPDATE OF status ON agents
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_workspace_ready_on_agent();

COMMENT ON COLUMN onboarding_sessions.invited_by_consultant IS 'The consultant who created this workspace and sent the invitation';
COMMENT ON COLUMN onboarding_sessions.workspace_ready IS 'Whether the workspace is ready for client use (has CompanyOS and active agents)';
COMMENT ON COLUMN onboarding_sessions.skip_company_os_creation IS 'Whether to skip CompanyOS creation in onboarding (consultant will do it)';
COMMENT ON COLUMN onboarding_sessions.skip_agent_creation IS 'Whether to skip agent creation in onboarding (consultant will do it)';
COMMENT ON FUNCTION check_workspace_ready IS 'Checks if a workspace has CompanyOS and active agents (ready for client)';
COMMENT ON FUNCTION mark_workspace_ready IS 'Updates workspace_ready flag for all onboarding sessions of a company';
