-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', false, 52428800, ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

-- Add attachments column to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Create RLS policies for chat-files bucket
CREATE POLICY "Users can view chat files from their company" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'chat-files' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can upload chat files to their company folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update chat files they uploaded" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete chat files they uploaded" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);