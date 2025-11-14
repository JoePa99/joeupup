-- Fix notification trigger to handle channel deletion gracefully
-- When a channel is deleted, members don't need to be notified they were "removed"
-- Also add missing DELETE policy for channels table

-- 1. Add DELETE policy for channels
DROP POLICY IF EXISTS "Users can delete channels they created or are admin of" ON channels;
CREATE POLICY "Users can delete channels they created or are admin of" 
ON channels 
FOR DELETE 
USING (
  auth.role() = 'authenticated' AND
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) AND
  (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role = 'admin'
    )
  )
);

-- 2. Fix the notify_member_removed function to handle channel deletions
CREATE OR REPLACE FUNCTION public.notify_member_removed()
RETURNS TRIGGER AS $$
DECLARE
  channel_name text;
  removed_user_name text;
BEGIN
  -- Try to get channel name
  SELECT name INTO channel_name
  FROM channels
  WHERE id = OLD.channel_id;

  -- If channel doesn't exist, it's being deleted, so skip notification
  IF channel_name IS NULL THEN
    RETURN OLD;
  END IF;

  -- Get removed user name
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO removed_user_name
  FROM profiles
  WHERE id = OLD.user_id;

  removed_user_name := COALESCE(removed_user_name, 'A member');

  -- Notify the removed user
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    channel_id
  ) VALUES (
    OLD.user_id,
    'member_removed',
    'Removed from #' || channel_name,
    'You were removed from #' || channel_name,
    jsonb_build_object(
      'channel_name', channel_name,
      'member_name', removed_user_name,
      'jump_url', '/channels'
    ),
    OLD.channel_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_member_removed IS 'Creates notifications when users are removed from channels (skips if channel is being deleted)';

