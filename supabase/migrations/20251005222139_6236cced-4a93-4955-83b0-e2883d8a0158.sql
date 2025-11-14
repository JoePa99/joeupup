-- Update copy_default_agent_to_company to prioritize agents table first
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_role text; 
  v_company uuid;
  v_type uuid;
  v_agent_name text;
  v_agent_description text;
  v_agent_config jsonb;
  v_agent_status agent_status;
BEGIN
  -- Authorization check: platform admin or company admin
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Try to find in agents table first (where is_default = true)
  SELECT agent_type_id, name, description, configuration, status
  INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
  FROM public.agents 
  WHERE id = p_default_agent_id 
  AND is_default = true;

  -- If not found in agents, try default_agents table
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
    INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
    FROM public.default_agents 
    WHERE id = p_default_agent_id;
  END IF;

  -- If still not found, raise error
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  -- Check if agent type already exists for this company
  SELECT id INTO v_id 
  FROM public.agents a 
  WHERE a.company_id = p_company_id 
  AND a.agent_type_id = v_type 
  LIMIT 1;

  -- If agent type doesn't exist, create it
  IF v_id IS NULL THEN
    SELECT at.name INTO v_role
    FROM public.agent_types at
    WHERE at.id = v_type;

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
    VALUES (
      p_company_id, 
      v_type, 
      v_agent_name, 
      v_role,
      v_agent_description, 
      v_agent_config, 
      v_agent_status, 
      auth.uid(),
      true
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies to prioritize agents table first
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Try agents table first (where is_default = true)
  SELECT agent_type_id, name, description, configuration, status
    INTO v_type, v_name, v_desc, v_config, v_status
  FROM public.agents
  WHERE id = p_default_agent_id AND is_default = true;

  -- Fallback: try default_agents table
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
      INTO v_type, v_name, v_desc, v_config, v_status
    FROM public.default_agents
    WHERE id = p_default_agent_id;
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
$function$;