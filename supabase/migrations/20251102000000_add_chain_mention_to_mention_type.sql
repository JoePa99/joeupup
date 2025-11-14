-- Add 'chain_mention' to the mention_type constraint
-- This allows chained agent responses to be stored correctly

-- Drop the existing constraint
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_mention_type_check;

-- Recreate the constraint with 'chain_mention' included
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_mention_type_check 
CHECK (mention_type IN ('direct_mention', 'direct_conversation', 'chain_mention'));

-- Update the column comment to reflect the new value
COMMENT ON COLUMN public.chat_messages.mention_type IS 'Differentiates between agent mentions in channels (direct_mention), direct conversations with agents (direct_conversation), and chained agent responses (chain_mention)';

