-- Add Google Drive folder integration to companies table
-- This allows companies to link a Google Drive folder for document browsing

ALTER TABLE public.companies
ADD COLUMN google_drive_folder_id TEXT,
ADD COLUMN google_drive_folder_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.google_drive_folder_id IS 'Google Drive folder ID for company-wide document access';
COMMENT ON COLUMN public.companies.google_drive_folder_name IS 'Display name of the linked Google Drive folder';

-- Create index for faster lookups
CREATE INDEX idx_companies_google_drive_folder ON public.companies(google_drive_folder_id) WHERE google_drive_folder_id IS NOT NULL;














