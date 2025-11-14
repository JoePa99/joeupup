-- Fix missing RLS policies for tables used in onboarding

-- Add policies for agent_tag_assignments
CREATE POLICY "Users can manage agent tag assignments in their company"
ON public.agent_tag_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_tag_assignments.agent_id
    AND a.company_id = get_user_company_id()
  )
);

-- Add policies for agent_tags  
CREATE POLICY "Users can manage agent tags in their company"
ON public.agent_tags
FOR ALL
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- Add policies for company_settings
CREATE POLICY "Users can view their company settings"
ON public.company_settings
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
ON public.company_settings
FOR UPDATE
USING (company_id = get_user_company_id());

-- Add policies for document_access_logs
CREATE POLICY "Users can view document access logs in their company"
ON public.document_access_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_archives da
    WHERE da.id = document_access_logs.document_id
    AND da.company_id = get_user_company_id()
  )
);

-- Add policies for document_versions
CREATE POLICY "Users can manage document versions in their company"
ON public.document_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.document_archives da
    WHERE da.id = document_versions.document_id
    AND da.company_id = get_user_company_id()
  )
);

-- Add policies for playbook_activity
CREATE POLICY "Users can view playbook activity in their company"
ON public.playbook_activity
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert playbook activity"
ON public.playbook_activity
FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND user_id = auth.uid());

-- Add policies for usage_analytics
CREATE POLICY "Users can view usage analytics in their company"
ON public.usage_analytics
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert usage analytics"
ON public.usage_analytics
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Add policies for user_companies
CREATE POLICY "Users can view their company memberships"
ON public.user_companies
FOR SELECT
USING (user_id = auth.uid() OR company_id = get_user_company_id());

CREATE POLICY "Users can insert company memberships during signup"
ON public.user_companies
FOR INSERT
WITH CHECK (user_id = auth.uid());