-- Function to log chat message activities
CREATE OR REPLACE FUNCTION public.log_chat_message_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_channel_name text;
  v_title text;
  v_desc text;
  v_target_type text;
  v_target_id uuid;
  v_tags text[] := ARRAY['message'];
  v_category text := 'communication';
  v_type text;
BEGIN
  -- Determine company and target
  IF NEW.conversation_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM chat_conversations WHERE id = NEW.conversation_id;
    v_target_type := 'conversation';
    v_target_id := NEW.conversation_id;
  ELSIF NEW.channel_id IS NOT NULL THEN
    SELECT company_id, name INTO v_company_id, v_channel_name FROM channels WHERE id = NEW.channel_id;
    v_target_type := 'channel';
    v_target_id := NEW.channel_id;
  END IF;

  -- Build title and description
  v_desc := LEFT(COALESCE(NEW.content, ''), 140);
  IF NEW.agent_id IS NOT NULL OR NEW.role = 'assistant' THEN
    v_type := 'agent_message';
    v_title := COALESCE((SELECT name FROM agents WHERE id = NEW.agent_id), 'AI Agent') ||
               CASE WHEN v_channel_name IS NOT NULL THEN ' responded in #' || v_channel_name ELSE '' END;
  ELSE
    v_type := 'user_message';
    v_title := 'User message' || CASE WHEN v_channel_name IS NOT NULL THEN ' in #' || v_channel_name ELSE '' END;
  END IF;

  -- Insert activity
  INSERT INTO public.user_activities (
    user_id,
    company_id,
    agent_id,
    activity_type,
    activity_category,
    title,
    description,
    metadata,
    target_resource_type,
    target_resource_id,
    status,
    tags
  ) VALUES (
    NEW.user_id,
    v_company_id,
    NEW.agent_id,
    v_type,
    v_category,
    v_title,
    v_desc,
    jsonb_build_object(
      'message_id', NEW.id,
      'channel_name', v_channel_name
    ),
    v_target_type,
    v_target_id,
    'completed',
    v_tags
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_chat_message_activity ON public.chat_messages;
CREATE TRIGGER trg_log_chat_message_activity
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.log_chat_message_activity();

-- Function to log agent tag assignment activities
CREATE OR REPLACE FUNCTION public.log_agent_tag_assignment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_agent_name text;
  v_tag_name text;
BEGIN
  SELECT a.company_id, a.name INTO v_company_id, v_agent_name FROM agents a WHERE a.id = NEW.agent_id;
  SELECT t.name INTO v_tag_name FROM agent_tags t WHERE t.id = NEW.tag_id;

  INSERT INTO public.user_activities (
    user_id,
    company_id,
    agent_id,
    activity_type,
    activity_category,
    title,
    description,
    metadata,
    target_resource_type,
    target_resource_id,
    status,
    tags
  ) VALUES (
    NEW.added_by,
    v_company_id,
    NEW.agent_id,
    'agent_tag_assigned',
    'tagging',
    'Tag "' || COALESCE(v_tag_name, 'tag') || '" added to ' || COALESCE(v_agent_name, 'agent'),
    NULL,
    jsonb_build_object('tag_id', NEW.tag_id, 'tag_name', v_tag_name),
    'agent',
    NEW.agent_id,
    'completed',
    ARRAY['tag','agent']
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agent_tag_assignment_activity ON public.agent_tag_assignments;
CREATE TRIGGER trg_log_agent_tag_assignment_activity
AFTER INSERT ON public.agent_tag_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_agent_tag_assignment_activity();