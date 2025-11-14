-- Fix storage policies for documents bucket
-- Drop all existing conflicting policies and create consolidated ones

-- Drop all existing policies for documents bucket (if they exist)
DROP POLICY IF EXISTS "Users can upload documents during onboarding" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their uploaded documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents from their company folder" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete_policy" ON storage.objects;

-- Create consolidated storage policies for documents bucket
-- These policies allow users to manage documents in their company folder

CREATE POLICY "documents_bucket_insert_policy" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow uploads to company folder (first folder = company_id)
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow uploads directly to onboarding folder during setup
    (storage.foldername(name))[1] = 'onboarding'
  )
);

CREATE POLICY "documents_bucket_select_policy" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow viewing company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow viewing onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow viewing own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "documents_bucket_update_policy" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow updating company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow updating onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow updating own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "documents_bucket_delete_policy" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow deleting company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow deleting onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow deleting own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Ensure the documents bucket exists and has the correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];

