-- Add platform admin policies for playbook sections and related tables
-- This allows platform-admins to view all companies' playbook sections

-- Platform admin can view all playbook sections
CREATE POLICY "Platform admins can view all playbook sections" 
ON public.playbook_sections
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');

-- Platform admin can view all companies (needed for joins in usePlaybookSections)
CREATE POLICY "Platform admins can view all companies" 
ON public.companies
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');

-- Platform admin can view all profiles (needed for joins in usePlaybookSections)
CREATE POLICY "Platform admins can view all profiles" 
ON public.profiles
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');
