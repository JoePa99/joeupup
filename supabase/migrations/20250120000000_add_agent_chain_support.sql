-- Add agent chain support to chat_messages table
-- This enables sequential agent processing where multiple agents can be tagged in one message

-- Add agent_chain column to store list of agents to process
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS agent_chain uuid[] DEFAULT '{}';

-- Add chain_index to track position in chain (0 = first agent, 1 = second, etc.)
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS chain_index integer DEFAULT NULL;

-- Add parent_message_id to link chained responses
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_chain ON public.chat_messages USING GIN(agent_chain);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chain_index ON public.chat_messages(chain_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent_message_id ON public.chat_messages(parent_message_id);

-- Add comments
COMMENT ON COLUMN public.chat_messages.agent_chain IS 'Array of agent IDs to process sequentially after current agent';
COMMENT ON COLUMN public.chat_messages.chain_index IS 'Position in the agent chain (0-indexed). NULL for non-chain messages';
COMMENT ON COLUMN public.chat_messages.parent_message_id IS 'Links to the original user message that started the chain';








