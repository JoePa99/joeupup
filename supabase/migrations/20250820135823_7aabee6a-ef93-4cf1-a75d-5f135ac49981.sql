-- Add openai_thread_id column to chat_conversations table
ALTER TABLE public.chat_conversations 
ADD COLUMN openai_thread_id TEXT;