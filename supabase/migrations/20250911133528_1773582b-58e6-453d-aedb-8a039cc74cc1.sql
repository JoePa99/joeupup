-- Add mention_type field to chat_messages table to differentiate between direct mentions in channels and direct conversations
ALTER TABLE public.chat_messages 
ADD COLUMN mention_type text CHECK (mention_type IN ('direct_mention', 'direct_conversation'));

-- Add comment for clarity
COMMENT ON COLUMN public.chat_messages.mention_type IS 'Differentiates between agent mentions in channels (direct_mention) and direct conversations with agents (direct_conversation)';