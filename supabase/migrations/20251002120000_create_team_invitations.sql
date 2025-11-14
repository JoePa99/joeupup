-- Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  personal_message TEXT,
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX idx_team_invitations_company_id ON team_invitations(company_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(invitation_token);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_invited_by ON team_invitations(invited_by);

-- Enable Row Level Security
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view invitations they sent
CREATE POLICY "Users can view invitations they sent"
  ON team_invitations
  FOR SELECT
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can create invitations for their company
CREATE POLICY "Users can create invitations for their company"
  ON team_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can update invitations they sent (e.g., to cancel)
CREATE POLICY "Users can update invitations they sent"
  ON team_invitations
  FOR UPDATE
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can delete invitations they sent
CREATE POLICY "Users can delete invitations they sent"
  ON team_invitations
  FOR DELETE
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role = 'admin')
  );

-- Create function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Create a trigger to check for expired invitations periodically
-- Note: In production, you might want to use a cron job or edge function for this
CREATE OR REPLACE FUNCTION check_invitation_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expires_at < NOW() AND NEW.status = 'pending' THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invitation_expiry_check
  BEFORE INSERT OR UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION check_invitation_expiry();

-- Add helpful comments
COMMENT ON TABLE team_invitations IS 'Stores team member invitation information';
COMMENT ON COLUMN team_invitations.invitation_token IS 'Unique token used in invitation URLs';
COMMENT ON COLUMN team_invitations.expires_at IS 'When the invitation expires (default 7 days)';
COMMENT ON COLUMN team_invitations.status IS 'Current status of the invitation';

