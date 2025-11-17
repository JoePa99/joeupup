-- Create consultant_workspaces table
-- Enables many-to-many relationship between consultants and client companies
-- A consultant can manage multiple client workspaces

CREATE TABLE IF NOT EXISTS consultant_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure a consultant can only be assigned once per company
  UNIQUE(consultant_id, company_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consultant_workspaces_consultant_id ON consultant_workspaces(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_workspaces_company_id ON consultant_workspaces(company_id);

-- Enable RLS
ALTER TABLE consultant_workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Consultants can view their own workspace assignments
CREATE POLICY "Consultants can view their own workspaces"
  ON consultant_workspaces
  FOR SELECT
  USING (
    auth.uid() = consultant_id
    OR
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Platform admins can create workspace assignments
CREATE POLICY "Platform admins can create workspace assignments"
  ON consultant_workspaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform-admin', 'consultant')
    )
  );

-- Consultants and platform admins can update their workspace assignments
CREATE POLICY "Consultants can update their workspaces"
  ON consultant_workspaces
  FOR UPDATE
  USING (
    auth.uid() = consultant_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Platform admins can delete workspace assignments
CREATE POLICY "Platform admins can delete workspace assignments"
  ON consultant_workspaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultant_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultant_workspaces_updated_at
  BEFORE UPDATE ON consultant_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_consultant_workspaces_updated_at();

COMMENT ON TABLE consultant_workspaces IS 'Maps consultants to the client companies they manage. Enables multi-tenancy for consultants.';
