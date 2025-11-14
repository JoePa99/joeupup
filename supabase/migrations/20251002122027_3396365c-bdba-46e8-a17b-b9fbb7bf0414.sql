-- Add 'document_analysis' to the content_type constraint
-- This allows the generate-rich-content edge function to save document analysis results

-- Drop the existing constraint
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;

-- Recreate the constraint with document_analysis included
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_type_check 
CHECK (content_type IN ('text', 'image_generation', 'web_research', 'document_analysis', 'mixed'));

-- Verify the constraint was created correctly
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'chat_messages'::regclass 
AND conname = 'chat_messages_content_type_check';

-- Display current content_type usage
SELECT content_type, COUNT(*) as count
FROM chat_messages 
GROUP BY content_type
ORDER BY content_type;