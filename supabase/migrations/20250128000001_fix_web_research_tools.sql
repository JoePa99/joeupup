-- Fix Web Research Tools Configuration
-- Ensures all agents have access to the openai_web_research tool for Perplexity integration

-- First, ensure the openai_web_research tool exists with correct schema
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'openai_web_research',
  'OpenAI Web Research',
  'openai',
  'Perform web research using Perplexity API with current information and source citations',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The research query or topic to investigate"
      },
      "focus_areas": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific areas or aspects to focus the research on"
      },
      "depth": {
        "type": "string",
        "enum": ["quick", "detailed", "comprehensive"],
        "default": "detailed",
        "description": "The depth of research to perform"
      },
      "include_sources": {
        "type": "boolean",
        "default": true,
        "description": "Whether to include source citations in the results"
      }
    },
    "required": ["query"]
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schema_definition = EXCLUDED.schema_definition;

-- Get the tool ID for the web research tool
DO $$
DECLARE
    web_research_tool_id UUID;
BEGIN
    -- Get the tool ID
    SELECT id INTO web_research_tool_id 
    FROM public.tools 
    WHERE name = 'openai_web_research';
    
    IF web_research_tool_id IS NOT NULL THEN
        -- Add web research tool to all existing agents that don't have it
        INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
        SELECT 
            a.id as agent_id,
            web_research_tool_id as tool_id,
            true as is_enabled,
            '{}'::jsonb as configuration
        FROM public.agents a
        WHERE NOT EXISTS (
            SELECT 1 FROM public.agent_tools at 
            WHERE at.agent_id = a.id AND at.tool_id = web_research_tool_id
        );
        
        RAISE NOTICE 'Added web research tool to agents missing it';
        
        -- Enable the tool for agents that have it disabled
        UPDATE public.agent_tools 
        SET is_enabled = true
        WHERE tool_id = web_research_tool_id AND is_enabled = false;
        
        RAISE NOTICE 'Enabled web research tool for previously disabled agents';
    ELSE
        RAISE NOTICE 'Web research tool not found - skipping agent updates';
    END IF;
END $$;

-- Update the trigger function to include web research tool for new agents
CREATE OR REPLACE FUNCTION add_openai_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all OpenAI tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'openai';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_add_openai_tools_to_new_agent ON public.agents;
CREATE TRIGGER trigger_add_openai_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_openai_tools_to_new_agent();

-- Create index for better performance on agent_tools queries
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id_enabled 
ON public.agent_tools (tool_id, is_enabled) 
WHERE is_enabled = true;

-- Create index for agent_tools lookups by agent
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id_enabled 
ON public.agent_tools (agent_id, is_enabled) 
WHERE is_enabled = true;

-- Add comment explaining the web research integration
COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. Web research tool (openai_web_research) uses Perplexity API for current information.';

-- Add helpful view for monitoring web research tool availability
CREATE OR REPLACE VIEW agent_web_research_status AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.status as agent_status,
    c.name as company_name,
    CASE 
        WHEN at.id IS NOT NULL AND at.is_enabled = true THEN 'Enabled'
        WHEN at.id IS NOT NULL AND at.is_enabled = false THEN 'Disabled'
        ELSE 'Not Available'
    END as web_research_status,
    at.configuration as tool_configuration
FROM public.agents a
LEFT JOIN public.companies c ON a.company_id = c.id
LEFT JOIN public.tools t ON t.name = 'openai_web_research'
LEFT JOIN public.agent_tools at ON at.agent_id = a.id AND at.tool_id = t.id;

-- Grant access to the view
GRANT SELECT ON agent_web_research_status TO authenticated;
GRANT SELECT ON agent_web_research_status TO service_role;
