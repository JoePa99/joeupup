-- Make conversation_id nullable in chat_messages table to support channel messages
ALTER TABLE public.chat_messages 
ALTER COLUMN conversation_id DROP NOT NULL;