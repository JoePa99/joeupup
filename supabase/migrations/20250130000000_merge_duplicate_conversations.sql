-- Merge duplicate conversations to ensure single conversation per user-agent-company
-- This migration safely consolidates any existing duplicates before enforcing uniqueness

BEGIN;

-- Create a temporary table to identify duplicate groups and choose which to keep
CREATE TEMP TABLE conversation_duplicates AS
WITH duplicate_groups AS (
  SELECT 
    user_id,
    agent_id, 
    company_id,
    array_agg(id ORDER BY created_at ASC, id ASC) as conversation_ids,
    min(id) as keep_id
  FROM chat_conversations
  GROUP BY user_id, agent_id, company_id
  HAVING count(*) > 1
)
SELECT 
  user_id,
  agent_id,
  company_id,
  keep_id,
  array_remove(conversation_ids, keep_id) as remove_ids
FROM duplicate_groups;

-- Log how many duplicates we found
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT count(*) INTO duplicate_count FROM conversation_duplicates;
  RAISE NOTICE 'Found % duplicate conversation groups to merge', duplicate_count;
END $$;

-- Reassign messages from duplicate conversations to the kept conversation
UPDATE chat_messages 
SET conversation_id = cd.keep_id
FROM conversation_duplicates cd
WHERE chat_messages.conversation_id = ANY(cd.remove_ids);

-- Log how many messages were reassigned
DO $$
DECLARE
  reassigned_count INTEGER;
BEGIN
  SELECT count(*) INTO reassigned_count 
  FROM chat_messages cm
  JOIN conversation_duplicates cd ON cm.conversation_id = ANY(cd.remove_ids);
  RAISE NOTICE 'Reassigned % messages to kept conversations', reassigned_count;
END $$;

-- Delete the duplicate conversations
DELETE FROM chat_conversations 
WHERE id IN (
  SELECT unnest(remove_ids) 
  FROM conversation_duplicates
);

-- Log how many conversations were deleted
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT count(*) INTO deleted_count 
  FROM conversation_duplicates cd
  JOIN unnest(cd.remove_ids) AS id ON true;
  RAISE NOTICE 'Deleted % duplicate conversations', deleted_count;
END $$;

-- Ensure the unique index exists (should already be there from previous migration)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_agent_company_conversation 
ON public.chat_conversations (user_id, agent_id, company_id);

-- Verify no duplicates remain
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT count(*) INTO remaining_duplicates
  FROM (
    SELECT user_id, agent_id, company_id
    FROM chat_conversations
    GROUP BY user_id, agent_id, company_id
    HAVING count(*) > 1
  ) duplicates;
  
  IF remaining_duplicates > 0 THEN
    RAISE EXCEPTION 'Migration failed: % duplicate groups still exist', remaining_duplicates;
  ELSE
    RAISE NOTICE 'Migration successful: No duplicate conversations remain';
  END IF;
END $$;

COMMIT;
