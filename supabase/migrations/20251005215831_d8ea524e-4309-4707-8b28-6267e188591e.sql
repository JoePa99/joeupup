-- Update copy_default_agent_to_company to handle both default_agents and agents IDs
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

  -- Try to find in default_agents table first
  SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
  INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
  FROM public.default_agents 
  WHERE id = p_default_agent_id;

  -- If not found in default_agents, try agents table (is_default = true)
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, configuration, status
    INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
    FROM public.agents 
    WHERE id = p_default_agent_id 
    AND is_default = true;
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