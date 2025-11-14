-- Fix channel_members RLS policy to allow proper visibility of team members
-- Users should be able to see all members of channels they have access to

-- Drop existing channel_members policies
DROP POLICY IF EXISTS "Users can view channel memberships" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;

-- Create new policies that allow proper visibility
CREATE POLICY "Users can view channel members for accessible channels" 
ON channel_members 
FOR SELECT 
USING (
  -- Users can see their own memberships
  user_id = auth.uid() OR
  -- Users can see all members of channels in their company
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);
