-- Modify companies table to support consultant management
-- Add fields for consultant ownership and client permissions

-- Add new columns
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS is_client_workspace BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS workspace_type TEXT DEFAULT 'client' CHECK (
    workspace_type IN ('client', 'consultant', 'internal')
  ),
  ADD COLUMN IF NOT EXISTS client_permissions JSONB DEFAULT '{
    "can_create_agents": false,
    "can_edit_company_os": false,
    "can_upload_documents": false,
    "can_create_playbooks": false,
    "can_contribute_to_playbooks": true,
    "can_invite_users": false,
    "can_view_analytics": false,
    "can_edit_profile": true,
    "can_view_agents": true,
    "can_chat_with_agents": true
  }'::jsonb;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_companies_managed_by ON companies(managed_by);
CREATE INDEX IF NOT EXISTS idx_companies_workspace_type ON companies(workspace_type);
CREATE INDEX IF NOT EXISTS idx_companies_is_client_workspace ON companies(is_client_workspace);

-- Update RLS policies to account for consultant management

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

-- Users can view their own company OR companies they manage as consultant
CREATE POLICY "Users can view their company or managed companies"
  ON companies
  FOR SELECT
  USING (
    -- User belongs to this company
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- User manages this company as consultant
    id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- User is platform admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Consultants and platform admins can create companies
CREATE POLICY "Consultants can create companies"
  ON companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform-admin', 'consultant')
    )
  );

-- Consultants can update companies they manage
CREATE POLICY "Consultants can update managed companies"
  ON companies
  FOR UPDATE
  USING (
    -- User manages this company
    id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
    OR
    -- Company admin (limited updates only)
    (
      id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
      AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Only platform admins can delete companies
CREATE POLICY "Platform admins can delete companies"
  ON companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Helper function to check if user has permission in a company
CREATE OR REPLACE FUNCTION user_has_company_permission(
  p_company_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  permissions JSONB;
  user_role TEXT;
BEGIN
  -- Get company permissions
  SELECT client_permissions INTO permissions
  FROM companies
  WHERE id = p_company_id;

  -- Get user role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  AND company_id = p_company_id;

  -- Platform admins and consultants have all permissions
  IF user_role IN ('platform-admin', 'consultant') THEN
    RETURN TRUE;
  END IF;

  -- Check if user is consultant managing this company
  IF EXISTS (
    SELECT 1 FROM consultant_workspaces
    WHERE consultant_id = auth.uid()
    AND company_id = p_company_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission
  RETURN COALESCE((permissions->p_permission)::boolean, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update client permissions (only consultants/admins)
CREATE OR REPLACE FUNCTION update_client_permissions(
  p_company_id UUID,
  p_permissions JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is consultant or platform admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role IN ('platform-admin', 'consultant')
      OR
      id IN (SELECT consultant_id FROM consultant_workspaces WHERE company_id = p_company_id)
    )
  ) THEN
    RAISE EXCEPTION 'Only consultants and platform admins can update client permissions';
  END IF;

  UPDATE companies
  SET client_permissions = p_permissions,
      updated_at = NOW()
  WHERE id = p_company_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN companies.managed_by IS 'The consultant who manages this client workspace';
COMMENT ON COLUMN companies.is_client_workspace IS 'Whether this is a client workspace (true) or consultant/internal workspace (false)';
COMMENT ON COLUMN companies.workspace_type IS 'Type of workspace: client, consultant, or internal';
COMMENT ON COLUMN companies.client_permissions IS 'JSON object defining what permissions client users have in this workspace';
COMMENT ON FUNCTION user_has_company_permission IS 'Checks if current user has a specific permission in a company';
COMMENT ON FUNCTION update_client_permissions IS 'Updates client permissions for a company (consultant/admin only)';
