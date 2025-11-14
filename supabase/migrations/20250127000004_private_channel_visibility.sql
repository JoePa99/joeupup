-- Update RLS policy for channels to respect privacy settings
-- Only show private channels to their members, public channels to all company users

-- Drop the existing policies
DROP POLICY IF EXISTS "Users can view channels in their company" ON channels;
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;

-- Create new policy that handles private channels properly
-- Use a simpler approach: show public channels to all company users,
-- and private channels only to users who are members
CREATE POLICY "Users can view public channels and private channels they are members of" 
ON channels 
FOR SELECT 
USING (
  company_id = get_user_company_id() AND (
    is_private = false OR 
    (is_private = true AND auth.uid() IN (
      SELECT user_id FROM channel_members 
      WHERE channel_id = channels.id
    ))
  )
);

-- Also update the policy for chat_messages to ensure private channel messages are protected
DROP POLICY IF EXISTS "Users can manage messages in their conversations and channels" ON chat_messages;

CREATE POLICY "Users can manage messages in their conversations and channels" 
ON chat_messages 
FOR ALL 
USING (
  (conversation_id IS NOT NULL AND conversation_id IN (
    SELECT chat_conversations.id
    FROM chat_conversations
    WHERE chat_conversations.company_id = get_user_company_id()
  )) OR
  (channel_id IS NOT NULL AND channel_id IN (
    SELECT channels.id
    FROM channels
    WHERE channels.company_id = get_user_company_id() AND (
      channels.is_private = false OR 
      (channels.is_private = true AND EXISTS (
        SELECT 1 FROM channel_members 
        WHERE channel_members.channel_id = channels.id 
        AND channel_members.user_id = auth.uid()
      ))
    )
  ))
);
