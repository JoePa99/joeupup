-- Update content_type constraint to include 'document_analysis'
-- First drop the old constraint if it exists
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;

-- Add the updated constraint with document_analysis
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_type_check 
CHECK (content_type IN ('text', 'image_generation', 'web_research', 'document_analysis', 'mixed'));

