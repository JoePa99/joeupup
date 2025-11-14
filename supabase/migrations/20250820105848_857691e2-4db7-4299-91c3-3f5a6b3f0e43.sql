-- Create channels table for team collaboration
CREATE TABLE channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channels
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (company_id = get_user_company_id());

CREATE POLICY "Users can create channels in their company" 
ON channels 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND created_by = auth.uid());

CREATE POLICY "Users can update channels they created" 
ON channels 
FOR UPDATE 
USING (created_by = auth.uid() OR company_id = get_user_company_id());

-- Create channel members table
CREATE TABLE channel_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on channel_members
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channel_members
CREATE POLICY "Users can view channel members for their company channels" 
ON channel_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_members.channel_id 
  AND c.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_members.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Create channel agents table
CREATE TABLE channel_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  added_by uuid NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, agent_id)
);

-- Enable RLS on channel_agents
ALTER TABLE channel_agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channel_agents
CREATE POLICY "Users can manage channel agents for their company channels" 
ON channel_agents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_agents.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Update chat_messages table to support both direct conversations and channels
ALTER TABLE chat_messages 
ADD COLUMN channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
ADD COLUMN message_type text DEFAULT 'direct' CHECK (message_type IN ('direct', 'channel')),
ADD CONSTRAINT check_conversation_or_channel 
  CHECK ((conversation_id IS NOT NULL AND channel_id IS NULL) OR 
         (conversation_id IS NULL AND channel_id IS NOT NULL));

-- Update RLS policy for chat_messages to include channel messages
DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON chat_messages;

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
    WHERE channels.company_id = get_user_company_id()
  ))
);

-- Create indexes for performance
CREATE INDEX idx_channels_company_id ON channels(company_id);
CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_channel_agents_channel_id ON channel_agents(channel_id);
CREATE INDEX idx_chat_messages_channel_id ON chat_messages(channel_id);

-- Create updated_at trigger for channels
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON channels
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();