-- Create tools table to define available tools in the system
CREATE TABLE public.tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  tool_type TEXT NOT NULL, -- 'gsuite', 'slack', 'stripe', etc.
  schema_definition JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_tools table to link agents with their available tools
CREATE TABLE public.agent_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  tool_id UUID NOT NULL,
  configuration JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE,
  UNIQUE(agent_id, tool_id)
);

-- Enable RLS
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for tools
CREATE POLICY "Anyone can view tools" 
ON public.tools 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage tools" 
ON public.tools 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

-- Create policies for agent_tools
CREATE POLICY "Users can view agent tools" 
ON public.agent_tools 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tools" 
ON public.agent_tools 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

-- Insert default G Suite tools
INSERT INTO public.tools (name, display_name, description, tool_type, schema_definition) VALUES
('gmail_search', 'Gmail Search', 'Search Gmail messages', 'gsuite', '{
  "actions": ["search"],
  "parameters": {
    "search": {
      "query": {"type": "string", "required": true},
      "maxResults": {"type": "number", "default": 10},
      "timeRange": {"type": "string", "enum": ["today", "yesterday", "week", "month"]}
    }
  }
}'::jsonb),
('drive_search', 'Google Drive Search', 'Search Google Drive files', 'gsuite', '{
  "actions": ["search"],
  "parameters": {
    "search": {
      "query": {"type": "string", "required": true},
      "fileType": {"type": "string", "enum": ["document", "spreadsheet", "presentation", "pdf"]},
      "maxResults": {"type": "number", "default": 10}
    }
  }
}'::jsonb),
('docs_read', 'Google Docs Reader', 'Read Google Documents content', 'gsuite', '{
  "actions": ["read"],
  "parameters": {
    "read": {
      "documentId": {"type": "string", "required": true}
    }
  }
}'::jsonb),
('sheets_read', 'Google Sheets Reader', 'Read Google Sheets data', 'gsuite', '{
  "actions": ["read"],
  "parameters": {
    "read": {
      "spreadsheetId": {"type": "string", "required": true},
      "range": {"type": "string"}
    }
  }
}'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_tools_updated_at
BEFORE UPDATE ON public.tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();