-- Create knowledge base table for structured storage
CREATE TABLE public.company_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  analysis_version INTEGER DEFAULT 1,
  company_overview TEXT,
  mission_vision TEXT, 
  products_services TEXT,
  target_market TEXT,
  key_differentiators TEXT,
  industry_classification TEXT,
  confidence_scores JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.company_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage knowledge base for their company" 
ON public.company_knowledge_base FOR ALL 
USING (company_id = get_user_company_id());

-- Create trigger for updated_at
CREATE TRIGGER update_company_knowledge_base_updated_at
BEFORE UPDATE ON public.company_knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();