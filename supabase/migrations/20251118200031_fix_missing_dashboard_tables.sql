-- Fix Missing Database Tables
-- ===========================
-- This migration adds missing tables that are preventing dashboard from loading

-- 1. CREATE NOTIFICATIONS TABLE AND RELATED TABLES
-- =================================================

-- Notifications table
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

-- Notification reads table
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- User presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id, conversation_id)
);

-- 2. CREATE CONSULTATION_REQUESTS TABLE
-- ======================================

CREATE TABLE IF NOT EXISTS public.consultation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  user_id UUID REFERENCES public.profiles(id),
  business_background TEXT,
  goals_objectives TEXT,
  current_challenges TEXT,
  target_market TEXT,
  competitive_landscape TEXT,
  preferred_meeting_times TEXT,
  additional_notes TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  company_size TEXT,
  industry TEXT,
  annual_revenue TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. CREATE PLAYBOOK_SECTIONS TABLE
-- ==================================

CREATE TABLE IF NOT EXISTS public.playbook_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  section_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  tags TEXT[],
  last_updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. ENABLE ROW LEVEL SECURITY
-- =============================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_sections ENABLE ROW LEVEL SECURITY;

-- 5. CREATE RLS POLICIES
-- =======================

-- Notifications policies
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

-- Notification reads policies
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

-- User presence policies
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

-- Consultation requests policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'consultation_requests'
        AND policyname = 'Users can insert their own consultation requests'
    ) THEN
        CREATE POLICY "Users can insert their own consultation requests"
        ON public.consultation_requests
        FOR INSERT
        WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'consultation_requests'
        AND policyname = 'Users can view their company consultation requests'
    ) THEN
        CREATE POLICY "Users can view their company consultation requests"
        ON public.consultation_requests
        FOR SELECT
        USING (company_id = get_user_company_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'consultation_requests'
        AND policyname = 'Users can update their company consultation requests'
    ) THEN
        CREATE POLICY "Users can update their company consultation requests"
        ON public.consultation_requests
        FOR UPDATE
        USING (company_id = get_user_company_id());
    END IF;
END $$;

-- Playbook sections policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'playbook_sections'
        AND policyname = 'Users can view playbook sections in their company'
    ) THEN
        CREATE POLICY "Users can view playbook sections in their company"
        ON public.playbook_sections
        FOR SELECT
        USING (company_id = get_user_company_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'playbook_sections'
        AND policyname = 'Users can update playbook sections in their company'
    ) THEN
        CREATE POLICY "Users can update playbook sections in their company"
        ON public.playbook_sections
        FOR UPDATE
        USING (company_id = get_user_company_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'playbook_sections'
        AND policyname = 'Users can insert playbook sections in their company'
    ) THEN
        CREATE POLICY "Users can insert playbook sections in their company"
        ON public.playbook_sections
        FOR INSERT
        WITH CHECK (company_id = get_user_company_id());
    END IF;
END $$;

-- 6. CREATE TRIGGERS
-- ===================

-- Trigger for notifications updated_at
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for user_presence updated_at
DROP TRIGGER IF EXISTS update_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for consultation_requests updated_at
DROP TRIGGER IF EXISTS update_consultation_requests_updated_at ON public.consultation_requests;
CREATE TRIGGER update_consultation_requests_updated_at
BEFORE UPDATE ON public.consultation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for playbook_sections updated_at
DROP TRIGGER IF EXISTS update_playbook_sections_updated_at ON public.playbook_sections;
CREATE TRIGGER update_playbook_sections_updated_at
BEFORE UPDATE ON public.playbook_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. CREATE INDEXES
-- =================

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

CREATE INDEX IF NOT EXISTS idx_consultation_requests_company_id ON consultation_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_user_id ON consultation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_status ON consultation_requests(status);

CREATE INDEX IF NOT EXISTS idx_playbook_sections_company_id ON playbook_sections(company_id);
CREATE INDEX IF NOT EXISTS idx_playbook_sections_status ON playbook_sections(status);

-- 8. CREATE HELPER FUNCTIONS
-- ===========================

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
    SELECT name INTO channel_name
    FROM channels
    WHERE id = NEW.channel_id;

    FOR target_user_id IN
      SELECT cm.user_id
      FROM channel_members cm
      WHERE cm.channel_id = NEW.channel_id
    LOOP
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = target_user_id
        AND up.channel_id = NEW.channel_id
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      IF NOT is_user_present THEN
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'channel_name', COALESCE(channel_name, 'Channel'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

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

  ELSIF NEW.conversation_id IS NOT NULL THEN
    SELECT user_id INTO conversation_user_id
    FROM chat_conversations
    WHERE id = NEW.conversation_id;

    IF conversation_user_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = conversation_user_id
        AND up.conversation_id = NEW.conversation_id
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      IF NOT is_user_present THEN
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

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
  UPDATE user_presence
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id
  AND (channel_id = p_channel_id OR (channel_id IS NULL AND p_channel_id IS NULL))
  AND (conversation_id = p_conversation_id OR (conversation_id IS NULL AND p_conversation_id IS NULL));
END;
$$;
