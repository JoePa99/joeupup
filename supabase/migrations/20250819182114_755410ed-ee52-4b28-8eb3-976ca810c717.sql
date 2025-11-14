-- Link the existing user to the existing company
UPDATE profiles 
SET company_id = '30d23777-62d1-4a07-b28f-4972bc3ecab8'
WHERE id = '83f17ede-6cb1-4fbd-9530-ef6b60c168c0';

-- Add a policy for users to view their own profile when they don't have company_id yet
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Update companies INSERT policy to be more explicit
DROP POLICY IF EXISTS "Users can insert companies during signup" ON public.companies;
CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);