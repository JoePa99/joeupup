-- Add unique constraint on playbook_sections for (company_id, title)
-- This allows upsert operations when populating playbooks from website analysis

ALTER TABLE public.playbook_sections 
ADD CONSTRAINT unique_company_playbook_section 
UNIQUE (company_id, title);


































