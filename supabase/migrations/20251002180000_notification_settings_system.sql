-- Complete Notification Settings System
-- This migration creates the user_notification_settings table and all necessary triggers

-- 1. Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS public.user_notification_settings CASCADE;

-- Create user_notification_settings table
CREATE TABLE public.user_notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can manage their own notification settings" ON public.user_notification_settings;
CREATE POLICY "Users can manage their own notification settings"
ON public.user_notification_settings FOR ALL
USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id ON user_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_type ON user_notification_settings(notification_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON public.user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
BEFORE UPDATE ON public.user_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Function to Initialize User Notification Preferences
CREATE OR REPLACE FUNCTION public.initialize_user_notification_settings(p_user_id uuid)
RETURNS void AS $$
DECLARE
  notification_types text[] := ARRAY[
    'mention', 'channel_message', 'agent_response', 
    'channel_created', 'channel_updated', 
    'document_shared', 'playbook_updated', 
    'system_alert', 'member_added', 'member_removed',
    'integration_connected', 'integration_error', 'webhook_received'
  ];
  notif_type text;
  email_default boolean;
BEGIN
  FOREACH notif_type IN ARRAY notification_types LOOP
    -- High priority notifications have email ON by default
    email_default := notif_type IN ('mention', 'system_alert', 'integration_error', 'agent_response');
    
    INSERT INTO user_notification_settings (user_id, notification_type, enabled, email_enabled)
    VALUES (p_user_id, notif_type, true, email_default)
    ON CONFLICT (user_id, notification_type) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to Initialize Settings on User Creation
CREATE OR REPLACE FUNCTION public.initialize_notification_settings_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_notification_settings(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_initialize_notification_settings ON public.profiles;
CREATE TRIGGER trigger_initialize_notification_settings
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_notification_settings_on_signup();

-- 4. Initialize settings for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles LOOP
    PERFORM initialize_user_notification_settings(user_record.id);
  END LOOP;
END $$;

-- 5. Document Shared Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_document_shared()
RETURNS TRIGGER AS $$
DECLARE
  company_members RECORD;
  uploader_name text;
  document_name text;
BEGIN
  -- Get uploader info
  SELECT first_name, last_name INTO uploader_name
  FROM profiles
  WHERE id = NEW.uploaded_by;
  
  uploader_name := COALESCE(uploader_name, 'Someone');
  document_name := NEW.file_name;

  -- Notify all company members except uploader
  FOR company_members IN 
    SELECT id, first_name, last_name 
    FROM profiles 
    WHERE company_id = NEW.company_id 
    AND id != NEW.uploaded_by
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_by
    ) VALUES (
      company_members.id,
      'document_shared',
      'Document shared: ' || document_name,
      uploader_name || ' shared "' || document_name || '"',
      jsonb_build_object(
        'document_name', document_name,
        'shared_by', uploader_name,
        'jump_url', '/documents'
      ),
      NEW.uploaded_by
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_document_shared ON public.document_archives;
CREATE TRIGGER trigger_notify_document_shared
AFTER INSERT ON public.document_archives
FOR EACH ROW
EXECUTE FUNCTION public.notify_document_shared();

-- 6. Playbook Updated Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_playbook_updated()
RETURNS TRIGGER AS $$
DECLARE
  company_members RECORD;
  updater_name text;
BEGIN
  -- Only notify on updates, not inserts
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get updater info
  SELECT first_name, last_name INTO updater_name
  FROM profiles
  WHERE id = NEW.updated_by;
  
  updater_name := COALESCE(updater_name, 'Someone');

  -- Notify all company members except updater
  FOR company_members IN 
    SELECT id, first_name, last_name 
    FROM profiles 
    WHERE company_id = NEW.company_id 
    AND id != NEW.updated_by
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_by
    ) VALUES (
      company_members.id,
      'playbook_updated',
      'Playbook updated',
      updater_name || ' updated the company playbook',
      jsonb_build_object(
        'playbook_name', 'Company Playbook',
        'updated_by', updater_name,
        'jump_url', '/playbook'
      ),
      NEW.updated_by
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_playbook_updated ON public.playbook_sections;
CREATE TRIGGER trigger_notify_playbook_updated
AFTER UPDATE ON public.playbook_sections
FOR EACH ROW
EXECUTE FUNCTION public.notify_playbook_updated();

-- 7. Channel Member Removed Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_member_removed()
RETURNS TRIGGER AS $$
DECLARE
  channel_name text;
  removed_user_name text;
BEGIN
  -- Get channel name
  SELECT name INTO channel_name
  FROM channels
  WHERE id = OLD.channel_id;

  -- Get removed user name
  SELECT first_name, last_name INTO removed_user_name
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

DROP TRIGGER IF EXISTS trigger_notify_member_removed ON public.channel_members;
CREATE TRIGGER trigger_notify_member_removed
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_member_removed();

-- 8. Integration Connected/Error Notifications (manual trigger via app)
-- These will be called from the application code when integrations connect/fail

-- 9. System Alert Notifications (manual trigger via admin)
-- These will be created by admins through the admin panel

-- 10. Webhook Received Notifications (manual trigger via webhook handlers)
-- These will be called when external webhooks are received

COMMENT ON TABLE user_notification_settings IS 'Stores user preferences for notification types and delivery methods';
COMMENT ON FUNCTION initialize_user_notification_settings IS 'Initializes default notification settings for a user with all 13 notification types';
COMMENT ON FUNCTION notify_document_shared IS 'Creates notifications when documents are shared/uploaded';
COMMENT ON FUNCTION notify_playbook_updated IS 'Creates notifications when playbook sections are updated';
COMMENT ON FUNCTION notify_member_removed IS 'Creates notifications when users are removed from channels';

