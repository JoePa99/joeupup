-- Provision OpenAI resources for company agents after seeding
-- This migration updates seeding functions to automatically provision OpenAI assistant and vector store
-- for each cloned company agent to ensure they have isolated knowledge bases

-- Enable http extension if not already enabled (needed to call edge functions from triggers)
CREATE EXTENSION IF NOT EXISTS http;

-- Create a helper function to call the provision edge function
CREATE OR REPLACE FUNCTION public.provision_agent_openai_resources(
  p_agent_id uuid,
  p_company_id uuid,
  p_agent_name text,
  p_agent_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_response json;
  v_result json;
BEGIN
  -- Call the provision-company-agent-openai edge function
  SELECT content::json INTO v_response
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/provision-company-agent-openai',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_key')),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'agent_id', p_agent_id::text,
      'company_id', p_company_id::text,
      'agent_name', p_agent_name,
      'agent_description', COALESCE(p_agent_description, '')
    )::text
  ));

  -- Check if the response indicates success
  IF (v_response->>'success')::boolean THEN
    RETURN json_build_object('success', true, 'data', v_response->'data');
  ELSE
    RAISE WARNING 'Failed to provision OpenAI resources for agent %: %', p_agent_name, v_response->>'error';
    RETURN json_build_object('success', false, 'error', v_response->>'error');
  END IF;
END;
$function$;

-- Update seed_default_agents_for_company() to provision OpenAI resources after cloning
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_record RECORD;
  v_provision_result json;
BEGIN
  -- Clone template agents to the new company
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
    )
  RETURNING id, name, description INTO v_agent_record;

  -- Provision OpenAI resources for the cloned agent
  IF FOUND THEN
    v_provision_result := public.provision_agent_openai_resources(
      v_agent_record.id,
      NEW.id,
      v_agent_record.name,
      v_agent_record.description
    );
    
    IF NOT (v_provision_result->>'success')::boolean THEN
      RAISE WARNING 'Failed to provision OpenAI resources for agent % in new company %: %', 
        v_agent_record.name, NEW.id, v_provision_result->>'error';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update copy_default_agent_to_company() to provision OpenAI resources
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
  v_provision_result json;
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
  
  -- Provision OpenAI resources for the cloned agent if it was just created
  IF v_id IS NOT NULL THEN
    -- Check if agent already has OpenAI configuration
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE id = v_id 
      AND assistant_id IS NOT NULL 
      AND vector_store_id IS NOT NULL
    ) THEN
      -- Get agent details for provisioning
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

-- Update seed_default_agent_to_all_companies() to provision OpenAI resources
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
  
  -- Provision OpenAI resources for all newly created agents
  IF v_count > 0 THEN
    -- Get the template name and description
    IF v_template IS NULL THEN
      SELECT da.name, da.description INTO v_template
      FROM public.default_agents da
      WHERE da.id = p_default_agent_id;
    END IF;
    
    -- Provision resources for each newly created agent
    FOR v_company IN (
      SELECT DISTINCT a.id as agent_id, a.company_id, c.name as company_name
      FROM public.agents a
      JOIN public.companies c ON c.id = a.company_id
      WHERE a.created_by = auth.uid()
        AND a.created_at > NOW() - INTERVAL '1 minute'  -- Recently created
        AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)
    ) LOOP
      v_provision_result := public.provision_agent_openai_resources(
        v_company.agent_id,
        v_company.company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI resources for agent % in company %: %', 
          v_template.name, v_company.company_name, v_provision_result->>'error';
      END IF;
    END LOOP;
  END IF;

  RETURN v_count;
END;
$function$;
