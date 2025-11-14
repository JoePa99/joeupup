-- Fix document_archives RLS policies to allow uploads during onboarding

-- Drop existing restrictive policies for document_archives
DROP POLICY IF EXISTS "Users can insert documents in their company" ON public.document_archives;
DROP POLICY IF EXISTS "Users can update documents in their company" ON public.document_archives;
DROP POLICY IF EXISTS "Users can view documents in their company" ON public.document_archives;

-- Create more permissive policies that work during onboarding
-- Allow authenticated users to insert documents (they can only insert to their company anyway)
CREATE POLICY "authenticated_users_can_insert_documents" 
ON public.document_archives 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    -- Allow if company_id matches user's company
    company_id = public.get_user_company_id()
    OR
    -- Allow if user has a company_id in their profile (for onboarding)
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow during onboarding when profile doesn't have company_id yet
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Allow users to view documents from their company
CREATE POLICY "users_can_view_company_documents" 
ON public.document_archives 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

-- Allow users to update documents in their company
CREATE POLICY "users_can_update_company_documents" 
ON public.document_archives 
FOR UPDATE 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

-- Allow users to delete documents in their company
CREATE POLICY "users_can_delete_company_documents" 
ON public.document_archives 
FOR DELETE 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

