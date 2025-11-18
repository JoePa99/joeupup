-- Fix mark_workspace_ready function to also update status field
-- This ensures that isOnboardingComplete becomes true when workspace is ready

-- First, fix existing records where workspace_ready is true but status is not completed
UPDATE onboarding_sessions
SET status = 'completed',
    updated_at = NOW()
WHERE workspace_ready = true
  AND status != 'completed';

-- Now update the function to maintain this behavior going forward
CREATE OR REPLACE FUNCTION mark_workspace_ready(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_ready BOOLEAN;
BEGIN
  is_ready := check_workspace_ready(p_company_id);

  -- Update all onboarding sessions for this company
  -- Set both workspace_ready AND status when workspace is ready
  UPDATE onboarding_sessions
  SET workspace_ready = is_ready,
      status = CASE WHEN is_ready THEN 'completed' ELSE status END,
      updated_at = NOW()
  WHERE company_id = p_company_id;

  RETURN is_ready;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_workspace_ready IS 'Updates workspace_ready flag and status (to completed) for all onboarding sessions when workspace is ready';
