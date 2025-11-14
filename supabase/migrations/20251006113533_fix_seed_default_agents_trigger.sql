-- Fix seed_default_agents_for_company to use auth.uid() instead of NEW.created_by
-- This resolves the error: record "new" has no field "created_by"
-- The companies table doesn't have a created_by column, so we use auth.uid() instead

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
    auth.uid(),  -- Changed from NEW.created_by to auth.uid()
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

