-- Remove company_id requirement from agents table and make agents global
-- Update agents to remove company_id constraint (make it nullable for migration)
ALTER TABLE public.agents ALTER COLUMN company_id DROP NOT NULL;

-- Drop existing RLS policies on agents table
DROP POLICY IF EXISTS "Users can manage agents in their company" ON public.agents;
DROP POLICY IF EXISTS "Users can view agents in their company" ON public.agents;

-- Create new RLS policies for global agents
CREATE POLICY "Anyone can view agents" ON public.agents
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agents" ON public.agents
FOR ALL USING (get_user_role() = 'admin');

-- Update chat_conversations RLS to allow conversations with any agent
DROP POLICY IF EXISTS "Users can manage conversations in their company" ON public.chat_conversations;

CREATE POLICY "Users can manage their own conversations" ON public.chat_conversations
FOR ALL USING (user_id = auth.uid());

-- Update agent_documents RLS to work with global agents
DROP POLICY IF EXISTS "Users can manage agent documents in their company" ON public.agent_documents;

CREATE POLICY "Users can view agent documents" ON public.agent_documents
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent documents" ON public.agent_documents
FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update agent documents" ON public.agent_documents
FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete agent documents" ON public.agent_documents
FOR DELETE USING (get_user_role() = 'admin');

-- Update agent_metrics RLS to allow viewing metrics for all agents
DROP POLICY IF EXISTS "Users can view agent metrics in their company" ON public.agent_metrics;

CREATE POLICY "Users can view all agent metrics" ON public.agent_metrics
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Update agent_tag_assignments RLS for global agents
DROP POLICY IF EXISTS "Users can manage agent tag assignments in their company" ON public.agent_tag_assignments;

CREATE POLICY "Users can view agent tag assignments" ON public.agent_tag_assignments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tag assignments" ON public.agent_tag_assignments
FOR ALL USING (get_user_role() = 'admin');

-- Update agent_tags RLS to be global
DROP POLICY IF EXISTS "Users can manage agent tags in their company" ON public.agent_tags;

CREATE POLICY "Users can view agent tags" ON public.agent_tags
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tags" ON public.agent_tags
FOR ALL USING (get_user_role() = 'admin');

-- Update channel_agents RLS to allow adding any global agent to company channels
DROP POLICY IF EXISTS "Users can manage channel agents for their company channels" ON public.channel_agents;

CREATE POLICY "Users can manage channel agents for their company channels" ON public.channel_agents
FOR ALL USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_agents.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Clean up duplicate agents - keep one agent per agent_type_id
-- This will merge duplicate agents by keeping the most recently created one
DELETE FROM public.agents a1 
WHERE EXISTS (
  SELECT 1 FROM public.agents a2 
  WHERE a1.agent_type_id = a2.agent_type_id 
  AND a1.created_at < a2.created_at
);

-- Set remaining agents to have no company_id (making them global)
UPDATE public.agents SET company_id = NULL;