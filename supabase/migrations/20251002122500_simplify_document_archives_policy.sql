-- Simplify document_archives RLS policies - super permissive for authenticated users

-- Drop all existing policies for document_archives
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'document_archives' 
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.document_archives';
    END LOOP;
END $$;

-- Create simple policies that just check authentication
CREATE POLICY "authenticated_insert_document_archives" 
ON public.document_archives 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_select_document_archives" 
ON public.document_archives 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_document_archives" 
ON public.document_archives 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_document_archives" 
ON public.document_archives 
FOR DELETE 
USING (auth.role() = 'authenticated');

