-- Add INSERT policy for playbook_sections to allow all company users to create sections
CREATE POLICY "Users can insert playbook sections in their company" 
ON public.playbook_sections
FOR INSERT 
WITH CHECK (company_id = public.get_user_company_id());

