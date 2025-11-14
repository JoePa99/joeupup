-- Migrate company agent seeding to use template agents from agents table
-- Template agents are stored in agents table with is_default = TRUE and company_id IS NULL
-- This migration updates the trigger and functions to clone from agents table instead of default_agents

-- Step 1: Update seed_default_agents_for_company() to use agents table
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
    is_default,
    system_instructions
  )
  SELECT 
    NEW.id,  -- New company's ID
    template.agent_type_id, 
    template.name, 
    template.role,
    template.description, 
    template.configuration, 
    template.status, 
    auth.uid(),
    false,  -- Cloned agents are NOT default, only templates are
    template.system_instructions  -- Copy system instructions from template
  FROM public.agents template
  WHERE template.is_default = TRUE 
    AND template.company_id IS NULL  -- Template agents
    AND NOT EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = NEW.id 
      AND a.agent_type_id = template.agent_type_id
    );
  RETURN NEW;
END;
$function$;

-- Step 2: Update copy_default_agent_to_company() to prioritize agents table
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
  v_template RECORD;
BEGIN
  -- Authorization check
  IF NOT public.is_platform_admin() THEN
    -- Check if user is company admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Get template agent (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents 
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback to default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, 
      description, configuration, status, created_by, is_default
    )
    SELECT 
      p_company_id, da.agent_type_id, da.name, at.name,
      da.description, da.config, 
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(), false  -- Cloned agents are NOT default
    FROM public.default_agents da
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE da.id = p_default_agent_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agents a 
        WHERE a.company_id = p_company_id 
        AND a.agent_type_id = da.agent_type_id
      )
    RETURNING id INTO v_id;
    
    -- Return existing if already exists
    IF v_id IS NULL THEN
      SELECT a.id INTO v_id 
      FROM public.agents a 
      JOIN public.default_agents da ON da.agent_type_id = a.agent_type_id
      WHERE da.id = p_default_agent_id
        AND a.company_id = p_company_id 
      LIMIT 1;
    END IF;
  ELSE
    -- Check if agent type already exists for this company
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
      AND a.agent_type_id = v_template.agent_type_id 
    LIMIT 1;
    
    -- Clone from agents table if doesn't exist
    IF v_id IS NULL THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, v_template.agent_type_id, v_template.name, v_template.role,
        v_template.description, v_template.configuration, v_template.status,
        auth.uid(), false, v_template.system_instructions  -- Cloned agents are NOT default, copy system_instructions
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Step 3: Update seed_default_agent_to_all_companies() to prioritize agents table
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(
  p_default_agent_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_template RECORD;
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;

  -- Try to get template from agents table (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback: try default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default
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
      false  -- Cloned agents are NOT default
    FROM public.companies c
    JOIN public.default_agents da ON da.id = p_default_agent_id
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = da.agent_type_id
    );
  ELSE
    -- Clone template from agents table to all companies
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default, system_instructions
    )
    SELECT
      c.id,
      v_template.agent_type_id,
      v_template.name,
      v_template.role,
      v_template.description,
      v_template.configuration,
      v_template.status,
      auth.uid(),
      false,  -- Cloned agents are NOT default, only templates are
      v_template.system_instructions  -- Copy system instructions from template
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = v_template.agent_type_id
    );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

