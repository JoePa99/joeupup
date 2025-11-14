-- Fix storage policies for document uploads during onboarding

-- Create policies for the documents bucket to allow uploads during onboarding
CREATE POLICY "Users can upload documents during onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'onboarding'
);

CREATE POLICY "Users can view their uploaded documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow access to onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    -- Allow access to company documents if user has company_id
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

CREATE POLICY "Users can update their documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

CREATE POLICY "Users can delete their documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);