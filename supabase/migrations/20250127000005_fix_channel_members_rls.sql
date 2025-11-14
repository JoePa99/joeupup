-- Fix channel_members RLS policy to work with private channels
-- Users should be able to see their own memberships and members of channels they have access to

-- Drop existing channel_members policies
DROP POLICY IF EXISTS "Users can view channel members for their company channels" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- Create new policies that allow users to see their own memberships and public channel memberships
CREATE POLICY "Users can view their own channel memberships and public channel members" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR -- Users can always see their own memberships
  EXISTS (
    SELECT 1 FROM channels c 
    WHERE c.id = channel_members.channel_id 
    AND c.company_id = get_user_company_id()
    AND c.is_private = false -- Public channels - anyone in company can see members
  ) OR
  -- Allow users to see memberships for channels they are members of (for private channels)
  auth.uid() IN (
    SELECT user_id FROM channel_members cm2 
    WHERE cm2.channel_id = channel_members.channel_id
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM channels c 
    WHERE c.id = channel_members.channel_id 
    AND c.company_id = get_user_company_id()
  )
);
