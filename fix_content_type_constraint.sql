-- Fix for content_type constraint issue
-- Run this in Supabase SQL Editor

-- First, let's see what the current constraint looks like
SELECT conname, contype, consrc 
FROM pg_constraint 
WHERE conrelid = 'chat_messages'::regclass 
AND conname LIKE '%content_type%';

-- Drop the existing constraint if it exists
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;

-- Recreate the constraint with proper values
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_type_check 
CHECK (content_type IN ('text', 'image_generation', 'web_research', 'mixed'));

-- Verify the constraint was created correctly
SELECT conname, contype, consrc 
FROM pg_constraint 
WHERE conrelid = 'chat_messages'::regclass 
AND conname LIKE '%content_type%';

-- Check current content_type values in the table
SELECT DISTINCT content_type, COUNT(*) 
FROM chat_messages 
GROUP BY content_type;

-- Set any NULL content_type values to 'text'
UPDATE chat_messages 
SET content_type = 'text' 
WHERE content_type IS NULL;

SELECT 'Content type constraint fixed successfully!' as status;



