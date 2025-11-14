-- Add is_default column to agents table
ALTER TABLE agents 
ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Mark existing agents as default if they match a default_agent by agent_type_id
UPDATE agents a
SET is_default = true
WHERE EXISTS (
  SELECT 1 FROM default_agents da
  WHERE da.agent_type_id = a.agent_type_id
);

-- Update the seeding function to set is_default = true for new default agents
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
    NEW.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    NEW.created_by,
    true
  FROM public.default_agents da
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = NEW.id 
    AND a.agent_type_id = da.agent_type_id
  );
  RETURN NEW;
END;
$function$;

-- Update the copy function to set is_default = true
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(
  p_default_agent_id uuid, 
  p_company_id uuid
)
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
BEGIN
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  SELECT agent_type_id INTO v_type 
  FROM public.default_agents 
  WHERE id = p_default_agent_id;

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
    p_company_id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    auth.uid(),
    true
  FROM public.default_agents da
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE da.id = p_default_agent_id
    AND NOT EXISTS (
      SELECT 1 FROM public.agents a 
      WHERE a.company_id = p_company_id 
      AND a.agent_type_id = da.agent_type_id
    )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
    AND a.agent_type_id = v_type 
    LIMIT 1;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Also update seed_default_agent_to_all_companies function
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_count int := 0; 
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;
  
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
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    auth.uid(),
    true
  FROM public.companies c
  JOIN public.default_agents da ON da.id = p_default_agent_id
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agents a 
    WHERE a.company_id = c.id 
    AND a.agent_type_id = da.agent_type_id
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;