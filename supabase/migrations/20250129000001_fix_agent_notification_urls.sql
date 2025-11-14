-- Fix agent notification URLs to redirect to client dashboard
-- This migration updates the agent message notification trigger to use the correct jump URLs

-- Update the function to use client-dashboard URLs for all agent notifications
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
