-- Add new message content types to support OpenAI tool results
-- This is a minimal migration to fix the immediate 400 error
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS tool_results JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';

-- Add check constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'chat_messages' 
        AND constraint_name = 'chat_messages_content_type_check'
    ) THEN
        ALTER TABLE public.chat_messages 
        ADD CONSTRAINT chat_messages_content_type_check 
        CHECK (content_type IN ('text', 'image_generation', 'web_research', 'mixed'));
    END IF;
END $$;

-- Create index on content_type for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_type ON public.chat_messages(content_type);

-- Create storage bucket for chat attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
  'chat-attachments', 
  'chat-attachments', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json']
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments'
);

-- Set up RLS policies for the chat-attachments bucket
DO $$ 
BEGIN
  -- Policy for viewing chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view chat attachments'
  ) THEN
    CREATE POLICY "Anyone can view chat attachments" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-attachments');
  END IF;

  -- Policy for uploading chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
  END IF;

  -- Policy for updating chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own chat attachments'
  ) THEN
    CREATE POLICY "Users can update their own chat attachments" ON storage.objects
    FOR UPDATE USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Policy for deleting chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own chat attachments'
  ) THEN
    CREATE POLICY "Users can delete their own chat attachments" ON storage.objects
    FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Success message
SELECT 'Image generation migration with storage bucket applied successfully!' as status;
