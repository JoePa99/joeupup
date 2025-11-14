-- Add raw_scraped_text column to company_os table for document uploads
ALTER TABLE public.company_os 
ADD COLUMN IF NOT EXISTS raw_scraped_text TEXT;

-- Add comment for the new column
COMMENT ON COLUMN public.company_os.raw_scraped_text IS 'Raw text extracted from uploaded documents for CompanyOS generation';





