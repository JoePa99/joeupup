-- Add status column to company_os table to track generation progress
-- This supports the two-step process: extract text -> generate CompanyOS

-- Create status enum type
CREATE TYPE company_os_status AS ENUM ('draft', 'extracting', 'generating', 'completed', 'failed');

-- Add status column with default 'completed' for backward compatibility
ALTER TABLE public.company_os 
ADD COLUMN IF NOT EXISTS status company_os_status DEFAULT 'completed' NOT NULL;

-- Make os_data nullable to allow draft records during text extraction
ALTER TABLE public.company_os 
ALTER COLUMN os_data DROP NOT NULL;

-- Create index for status-based queries
CREATE INDEX IF NOT EXISTS idx_company_os_status ON public.company_os(status);

-- Add comment for the new column
COMMENT ON COLUMN public.company_os.status IS 'Current status of CompanyOS generation: draft (text extracted), extracting (in progress), generating (AI processing), completed (ready), failed (error occurred)';




