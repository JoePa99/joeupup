-- Add agent message notification system
-- This migration creates a trigger to notify users when agents send messages
-- and they are not currently in the chat/channel

-- First, ensure the notifications table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification_reads table if not exists
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Create user_presence table to track if users are currently in chat/channel
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure only one active presence per user per channel/conversation
  UNIQUE(user_id, channel_id, conversation_id)
);

-- Enable RLS on new tables (only if not already enabled)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'notifications' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'notification_reads' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications" 
        ON public.notifications FOR SELECT 
        USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications" 
        ON public.notifications FOR UPDATE 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- RLS policies for notification_reads (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notification_reads' 
        AND policyname = 'Users can manage their own notification reads'
    ) THEN
        CREATE POLICY "Users can manage their own notification reads" 
        ON public.notification_reads FOR ALL 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- RLS policies for user_presence (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_presence' 
        AND policyname = 'Users can manage their own presence'
    ) THEN
        CREATE POLICY "Users can manage their own presence" 
        ON public.user_presence FOR ALL 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- Function to create agent message notifications
CREATE OR REPLACE FUNCTION public.create_agent_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  agent_name text;
  channel_name text;
  conversation_user_id uuid;
  is_user_present boolean;
  notification_data jsonb;
  jump_url text;
BEGIN
  -- Only process assistant messages (agent messages)
  IF NEW.role != 'assistant' THEN
    RETURN NEW;
  END IF;

  -- Get agent name
  SELECT name INTO agent_name 
  FROM agents 
  WHERE id = NEW.agent_id;

  -- Handle channel messages
  IF NEW.channel_id IS NOT NULL THEN
    -- Get channel name
    SELECT name INTO channel_name 
    FROM channels 
    WHERE id = NEW.channel_id;

    -- Get all channel members who should be notified
    FOR target_user_id IN 
      SELECT cm.user_id 
      FROM channel_members cm
      WHERE cm.channel_id = NEW.channel_id
    LOOP
      -- Check if user is currently present in the channel
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = target_user_id 
        AND up.channel_id = NEW.channel_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'channel_name', COALESCE(channel_name, 'Channel'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          channel_id,
          message_id,
          agent_id
        ) VALUES (
          target_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded in #' || COALESCE(channel_name, 'channel'),
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.channel_id,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END LOOP;

  -- Handle direct conversation messages
  ELSIF NEW.conversation_id IS NOT NULL THEN
    -- Get the user who owns this conversation
    SELECT user_id INTO conversation_user_id
    FROM chat_conversations
    WHERE id = NEW.conversation_id;

    IF conversation_user_id IS NOT NULL THEN
      -- Check if user is currently present in the conversation
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = conversation_user_id 
        AND up.conversation_id = NEW.conversation_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          message_id,
          agent_id
        ) VALUES (
          conversation_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded',
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for agent message notifications
DROP TRIGGER IF EXISTS trigger_agent_message_notification ON chat_messages;
CREATE TRIGGER trigger_agent_message_notification
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_agent_message_notification();

-- Function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_user_id uuid,
  p_channel_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert user presence
  INSERT INTO user_presence (user_id, channel_id, conversation_id, is_active, last_seen)
  VALUES (p_user_id, p_channel_id, p_conversation_id, true, now())
  ON CONFLICT (user_id, channel_id, conversation_id)
  DO UPDATE SET 
    is_active = true,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- Function to mark user as away
CREATE OR REPLACE FUNCTION public.mark_user_away(
  p_user_id uuid,
  p_channel_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark user as away
  UPDATE user_presence 
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id 
  AND (channel_id = p_channel_id OR (channel_id IS NULL AND p_channel_id IS NULL))
  AND (conversation_id = p_conversation_id OR (conversation_id IS NULL AND p_conversation_id IS NULL));
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications(agent_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_channel_id ON user_presence(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_conversation_id ON user_presence(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_active ON user_presence(is_active, last_seen);

-- Create trigger for updated_at on user_presence (only if it doesn't exist)
DROP TRIGGER IF EXISTS update_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
