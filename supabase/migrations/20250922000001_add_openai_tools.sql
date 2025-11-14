-- Add OpenAI tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'openai_image_generation',
  'OpenAI Image Generation',
  'openai',
  'Generate images using OpenAI DALL-E',
  '{
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The text prompt describing the image to generate"
      },
      "size": {
        "type": "string",
        "enum": ["1024x1024", "1792x1024", "1024x1792"],
        "default": "1024x1024",
        "description": "The size of the generated image"
      },
      "quality": {
        "type": "string",
        "enum": ["standard", "hd"],
        "default": "standard",
        "description": "The quality of the generated image"
      },
      "n": {
        "type": "integer",
        "minimum": 1,
        "maximum": 4,
        "default": 1,
        "description": "Number of images to generate"
      }
    },
    "required": ["prompt"]
  }'::jsonb
),
(
  'openai_web_research',
  'OpenAI Web Research',
  'openai',
  'Perform web research using OpenAI with web browsing capability',
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
);

-- Add new message content types to support OpenAI tool results
ALTER TABLE public.chat_messages 
ADD COLUMN tool_results JSONB DEFAULT NULL,
ADD COLUMN content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image_generation', 'web_research', 'mixed'));

-- Create index on content_type for better query performance
CREATE INDEX idx_chat_messages_content_type ON public.chat_messages(content_type);

-- Add OpenAI tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'openai'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add OpenAI tools to new agents
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

-- Create trigger to automatically add OpenAI tools to new agents
CREATE TRIGGER trigger_add_openai_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_openai_tools_to_new_agent();
