-- Fix Company Creation RLS Policy
-- ================================
-- This migration fixes the "query returned more than one row" error during signup
-- by adding created_by column and updating RLS policies

-- 1. Add created_by column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update existing companies to have created_by set to first admin user from each company
-- This is a best-effort backfill - some companies may not have created_by set
UPDATE public.companies 
SET created_by = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.company_id = public.companies.id 
    AND p.role = 'admin' 
  LIMIT 1
)
WHERE created_by IS NULL;

-- 3. Add RLS policy to allow users to SELECT companies they created
-- This is needed during signup when profile.company_id is not yet set
CREATE POLICY "Users can view companies they create"
ON public.companies
FOR SELECT
USING (created_by = auth.uid());

-- 4. Add RLS policy to allow users to SELECT companies they belong to (existing logic)
-- Keep the existing policy but make it more permissive for the created_by case
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = public.get_user_company_id() 
  OR created_by = auth.uid()
);

-- 5. Update INSERT policy to include created_by
-- The existing INSERT policy should remain, but we'll ensure created_by is set
-- This is handled in the application code

-- 6. Add index for performance on created_by lookups
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);
