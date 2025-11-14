-- Debug script to check image generation functionality

-- 1. Check if the new columns exist in chat_messages
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name IN ('tool_results', 'content_type')
ORDER BY column_name;

-- 2. Check if the storage bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'chat-attachments';

-- 3. Check recent chat messages to see if any have image content
SELECT 
    id,
    role,
    content_type,
    CASE 
        WHEN tool_results IS NOT NULL THEN 'HAS_TOOL_RESULTS'
        ELSE 'NO_TOOL_RESULTS'
    END as tool_results_status,
    LEFT(content, 100) as content_preview,
    created_at
FROM chat_messages 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check for any image generation messages specifically
SELECT 
    id,
    role,
    content_type,
    tool_results->>'tool_id' as tool_id,
    tool_results->'results'->>'success' as generation_success,
    tool_results->'results'->'images'->0->>'url' as image_url,
    LEFT(content, 100) as content_preview,
    created_at
FROM chat_messages 
WHERE content_type = 'image_generation'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND policyname LIKE '%chat%';



