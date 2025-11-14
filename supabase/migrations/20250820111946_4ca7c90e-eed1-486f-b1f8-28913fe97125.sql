-- Fix RLS policy for companies - allow authenticated users to create companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "Authenticated users can create companies" 
ON companies 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);