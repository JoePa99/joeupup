-- Add user_id column to chat_messages table to fix relationship with profiles
ALTER TABLE public.chat_messages 
ADD COLUMN user_id UUID REFERENCES auth.users(id);