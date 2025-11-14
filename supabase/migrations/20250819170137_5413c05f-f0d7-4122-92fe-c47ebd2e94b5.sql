-- Add pinecone_index_id to agents table
ALTER TABLE public.agents ADD COLUMN pinecone_index_id text;

-- Create default agent types if not exists
INSERT INTO public.agent_types (name, description, default_avatar_url) VALUES
('Marketing', 'AI assistant specialized in marketing strategies, content creation, and brand development', '/avatars/marketing.png'),
('Customer Service', 'AI assistant for customer support, issue resolution, and communication', '/avatars/customer-service.png'),
('Sales Development', 'AI assistant for lead generation, sales processes, and customer acquisition', '/avatars/sales.png'),
('Bookkeeper', 'AI assistant for financial management, accounting, and bookkeeping tasks', '/avatars/bookkeeper.png'),
('Business Analyst', 'AI assistant for data analysis, business intelligence, and strategic insights', '/avatars/analyst.png'),
('HR Journalist', 'AI assistant for human resources, recruitment, and internal communications', '/avatars/hr.png')
ON CONFLICT (name) DO NOTHING;

-- Create agent_documents table for managing document access per agent
CREATE TABLE IF NOT EXISTS public.agent_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agent_id, document_id)
);

-- Enable RLS on agent_documents
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for agent_documents
CREATE POLICY "Users can manage agent documents in their company" 
ON public.agent_documents 
FOR ALL 
USING (
  agent_id IN (
    SELECT agents.id FROM agents 
    WHERE agents.company_id = get_user_company_id()
  )
);

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_conversations
CREATE POLICY "Users can manage conversations in their company" 
ON public.chat_conversations 
FOR ALL 
USING (company_id = get_user_company_id());

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_messages
CREATE POLICY "Users can manage messages in their conversations" 
ON public.chat_messages 
FOR ALL 
USING (
  conversation_id IN (
    SELECT chat_conversations.id FROM chat_conversations 
    WHERE chat_conversations.company_id = get_user_company_id()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();