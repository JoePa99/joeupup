-- Create unique index to prevent duplicate conversations between user, agent, and company
-- This ensures only one conversation can exist per user-agent-company combination

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_agent_company_conversation 
ON public.chat_conversations (user_id, agent_id, company_id);

-- Add comment for documentation
COMMENT ON INDEX unique_user_agent_company_conversation IS 'Ensures only one conversation exists per user-agent-company combination to prevent duplicate conversations when switching agents';
