-- Quick migration to add image generation support
-- Run this in your Supabase SQL Editor

-- Add new columns to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS tool_results JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';

-- Add check constraint for content_type
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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_type ON public.chat_messages(content_type);

-- Success message
SELECT 'Image generation migration applied successfully!' as status;



