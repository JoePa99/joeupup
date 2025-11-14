-- Add agent_id column to chat_messages table to support agent mentions in channels
ALTER TABLE public.chat_messages 
ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

-- Add index for performance when querying messages by agent
CREATE INDEX idx_chat_messages_agent_id ON public.chat_messages(agent_id);

-- Add comment to document the purpose of the column
COMMENT ON COLUMN public.chat_messages.agent_id IS 'References the agent being called/mentioned in channel messages';



