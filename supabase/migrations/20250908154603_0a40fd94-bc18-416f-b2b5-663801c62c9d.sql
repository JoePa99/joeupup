-- Add nickname column to agents table for tagging functionality
ALTER TABLE public.agents 
ADD COLUMN nickname text;

-- Add unique constraint for nickname within each company to prevent duplicates
ALTER TABLE public.agents 
ADD CONSTRAINT agents_nickname_company_unique 
UNIQUE (nickname, company_id);