-- Fix is_platform_admin() to check both platform_admins table and profiles.role
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform-admin')
  INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Update seed_default_agent_to_all_companies to accept both default_agents and agents IDs
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_type uuid;
  v_name text;
  v_desc text;
  v_config jsonb;
  v_status agent_status := 'active';
  v_role text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Try default_agents first
  SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
    INTO v_type, v_name, v_desc, v_config, v_status
  FROM public.default_agents
  WHERE id = p_default_agent_id;

  -- Fallback: allow agents.id where is_default = true
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, configuration, status
      INTO v_type, v_name, v_desc, v_config, v_status
    FROM public.agents
    WHERE id = p_default_agent_id AND is_default = true;
  END IF;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  SELECT name INTO v_role FROM public.agent_types WHERE id = v_type;

  INSERT INTO public.agents (
    company_id,
    agent_type_id,
    name,
    role,
    description,
    configuration,
    status,
    created_by,
    is_default
  )
  SELECT
    c.id,
    v_type,
    v_name,
    v_role,
    v_desc,
    v_config,
    v_status,
    auth.uid(),
    true
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.company_id = c.id
      AND a.agent_type_id = v_type
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;