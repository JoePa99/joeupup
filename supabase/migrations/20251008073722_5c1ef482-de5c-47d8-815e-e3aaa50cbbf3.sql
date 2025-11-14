-- Update seed_default_agents_for_company to include nickname
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  template RECORD;
  v_provision_result json;
BEGIN
  FOR template IN 
    SELECT * FROM public.agents 
    WHERE is_default = TRUE AND company_id IS NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE company_id = p_company_id 
      AND agent_type_id = template.agent_type_id
    ) THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role, nickname,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, template.agent_type_id, template.name, template.role, template.nickname,
        template.description, template.configuration, template.status,
        auth.uid(), false, template.system_instructions
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

-- Update copy_default_agent_to_company to include nickname
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_template RECORD;
  v_provision_result json;
BEGIN
  -- Authorization check
  IF NOT public.is_platform_admin() THEN
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
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default
    )
    SELECT 
      p_company_id, da.agent_type_id, da.name, at.name, da.name as nickname,
      da.description, da.config, 
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(), false
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
        company_id, agent_type_id, name, role, nickname,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, v_template.agent_type_id, v_template.name, v_template.role, v_template.nickname,
        v_template.description, v_template.configuration, v_template.status,
        auth.uid(), false, v_template.system_instructions
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;
  
  -- Provision OpenAI resources for the cloned agent if it was just created
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE id = v_id 
      AND assistant_id IS NOT NULL 
      AND vector_store_id IS NOT NULL
    ) THEN
      SELECT name, description INTO v_template
      FROM public.agents 
      WHERE id = v_id;
      
      v_provision_result := public.provision_agent_openai_resources(
        v_id,
        p_company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI resources for agent % in company %: %', 
          v_template.name, p_company_id, v_provision_result->>'error';
      END IF;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies to include nickname
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_template RECORD;
  v_company RECORD;
  v_provision_result json;
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
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default
    )
    SELECT
      c.id,
      da.agent_type_id,
      da.name,
      at.name as role,
      da.name as nickname,
      da.description,
      da.config as configuration,
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(),
      false
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
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default, system_instructions
    )
    SELECT
      c.id,
      v_template.agent_type_id,
      v_template.name,
      v_template.role,
      v_template.nickname,
      v_template.description,
      v_template.configuration,
      v_template.status,
      auth.uid(),
      false,
      v_template.system_instructions
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = v_template.agent_type_id
    );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Provision OpenAI resources for all newly created agents
  IF v_count > 0 THEN
    IF v_template IS NULL THEN
      SELECT da.name, da.description INTO v_template
      FROM public.default_agents da
      WHERE da.id = p_default_agent_id;
    END IF;
    
    FOR v_company IN (
      SELECT DISTINCT a.id as agent_id, a.company_id, c.name as company_name
      FROM public.agents a
      JOIN public.companies c ON c.id = a.company_id
      WHERE a.created_by = auth.uid()
        AND a.created_at > NOW() - INTERVAL '1 minute'
        AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)
    ) LOOP
      v_provision_result := public.provision_agent_openai_resources(
        v_company.agent_id,
        v_company.company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI for agent in company %: %', 
          v_company.company_name, v_provision_result->>'error';
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_count;
END;
$function$;