-- Final fix for channel visibility issues
-- The problem might be with the complex RLS policy logic

-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;
DROP POLICY IF EXISTS "Users can view their own channel memberships and public channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- Create a simpler, more reliable channel visibility policy
CREATE POLICY "Users can view channels in their company with privacy respect" 
ON channels 
FOR SELECT 
USING (
  company_id = get_user_company_id() AND (
    is_private = false OR 
    id IN (
      SELECT channel_id 
      FROM channel_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Create a simpler channel_members policy
CREATE POLICY "Users can view channel memberships" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id() AND is_private = false
  ) OR
  auth.uid() IN (
    SELECT user_id FROM channel_members cm2 
    WHERE cm2.channel_id = channel_members.channel_id
  )
);

-- Allow channel management operations
CREATE POLICY "Users can manage channel members" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);
