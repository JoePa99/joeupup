-- Backfill existing agents with OpenAI configuration
-- This migration documents the process for running the backfill function
-- to provision OpenAI resources for existing company agents that are missing them

-- Note: This migration does not automatically run the backfill
-- The backfill must be triggered manually via API call to the edge function
-- This is intentional to allow for controlled execution and monitoring

-- Create a helper function to check which agents need backfill
CREATE OR REPLACE FUNCTION public.get_agents_needing_openai_config()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  company_name text,
  company_id uuid,
  missing_assistant_id boolean,
  missing_vector_store_id boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as agent_id,
    a.name as agent_name,
    c.name as company_name,
    a.company_id,
    (a.assistant_id IS NULL) as missing_assistant_id,
    (a.vector_store_id IS NULL) as missing_vector_store_id
  FROM public.agents a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.company_id IS NOT NULL  -- Only company agents
    AND a.status = 'active'       -- Only active agents
    AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)  -- Missing OpenAI config
  ORDER BY c.name, a.name;
$$;

-- Create a view for easier monitoring of agent OpenAI configuration status
CREATE OR REPLACE VIEW public.agent_openai_status AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  c.name as company_name,
  a.company_id,
  a.status,
  CASE 
    WHEN a.assistant_id IS NOT NULL AND a.vector_store_id IS NOT NULL THEN 'configured'
    WHEN a.assistant_id IS NULL AND a.vector_store_id IS NULL THEN 'missing_both'
    WHEN a.assistant_id IS NULL THEN 'missing_assistant'
    WHEN a.vector_store_id IS NULL THEN 'missing_vector_store'
    ELSE 'partial'
  END as openai_status,
  a.assistant_id,
  a.vector_store_id,
  a.created_at,
  a.updated_at
FROM public.agents a
LEFT JOIN public.companies c ON c.id = a.company_id
WHERE a.company_id IS NOT NULL  -- Only company agents
ORDER BY c.name, a.name;

-- Grant appropriate permissions
GRANT SELECT ON public.agent_openai_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_needing_openai_config() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_agents_needing_openai_config() IS 
'Returns all company agents that are missing OpenAI assistant_id or vector_store_id configuration';

COMMENT ON VIEW public.agent_openai_status IS 
'Shows the OpenAI configuration status for all company agents';

-- Create an index to optimize queries for agents needing configuration
CREATE INDEX IF NOT EXISTS idx_agents_missing_openai_config 
ON public.agents (company_id, status) 
WHERE company_id IS NOT NULL 
  AND (assistant_id IS NULL OR vector_store_id IS NULL);

/*
=== MANUAL BACKFILL INSTRUCTIONS ===

To backfill existing agents with OpenAI configuration, you need to call the edge function manually:

1. First, check which agents need backfill:
   SELECT * FROM public.get_agents_needing_openai_config();

2. Run a dry-run to see what would be processed:
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": true,
     "limit": 10
   }

3. Run the actual backfill (start with small batches):
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": false,
     "limit": 5
   }

4. Monitor progress using the view:
   SELECT * FROM public.agent_openai_status 
   WHERE openai_status != 'configured';

5. Continue with larger batches once confirmed working:
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": false,
     "limit": 20
   }

Notes:
- The backfill function processes agents in batches to avoid timeouts
- Each agent gets its own unique OpenAI assistant and vector store
- Failed agents will be logged with error details
- You can monitor the agent_openai_status view to track progress
- The process is idempotent - running it multiple times is safe

Expected outcome:
- All company agents will have assistant_id and vector_store_id populated
- Document uploads to agent knowledge bases will work correctly
- Each company will have isolated knowledge bases per agent type
*/
