-- Create company_os table for storing comprehensive company context
CREATE TABLE IF NOT EXISTS public.company_os (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  os_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_url TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.75 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Create index for faster lookups
CREATE INDEX idx_company_os_company_id ON public.company_os(company_id);
CREATE INDEX idx_company_os_generated_at ON public.company_os(generated_at DESC);

-- Enable RLS
ALTER TABLE public.company_os ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view CompanyOS for their own company
CREATE POLICY "Users can view their company's OS"
  ON public.company_os
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Users can insert CompanyOS for their company
CREATE POLICY "Users can create their company's OS"
  ON public.company_os
  FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Users can update CompanyOS for their company
CREATE POLICY "Users can update their company's OS"
  ON public.company_os
  FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

-- Platform admins can view all CompanyOS
CREATE POLICY "Platform admins can view all company OS"
  ON public.company_os
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_company_os_updated_at
  BEFORE UPDATE ON public.company_os
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.company_os IS 'Stores comprehensive company operating system context for AI agents';

