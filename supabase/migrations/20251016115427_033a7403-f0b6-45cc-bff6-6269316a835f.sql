-- Drop all existing policies on team_invitations
DROP POLICY IF EXISTS "Users can view invitations they sent or company invitations" ON team_invitations;
DROP POLICY IF EXISTS "Admin and moderator users can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users can update invitations they sent or company invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users can delete invitations they sent" ON team_invitations;
DROP POLICY IF EXISTS "Company admins and platform admins can delete invitations" ON team_invitations;

-- Create comprehensive policies with platform admin support

-- SELECT: Platform admins can view all, company members can view their company's invitations
CREATE POLICY "Platform admins and company members can view invitations"
ON team_invitations
FOR SELECT
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- INSERT: Platform admins and company admins can create invitations
CREATE POLICY "Platform admins and company admins can create invitations"
ON team_invitations
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- UPDATE: Platform admins and authorized users can update invitations
CREATE POLICY "Platform admins and authorized users can update invitations"
ON team_invitations
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- DELETE: Platform admins and company admins can delete invitations
CREATE POLICY "Platform admins and company admins can delete invitations"
ON team_invitations
FOR DELETE
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role = 'admin'
  ))
);