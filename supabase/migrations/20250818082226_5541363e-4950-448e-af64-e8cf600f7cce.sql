-- Create consultation_requests table
CREATE TABLE public.consultation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  user_id UUID REFERENCES public.profiles(id),
  business_background TEXT,
  goals_objectives TEXT,
  current_challenges TEXT,
  target_market TEXT,
  competitive_landscape TEXT,
  preferred_meeting_times TEXT,
  additional_notes TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  company_size TEXT,
  industry TEXT,
  annual_revenue TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on consultation_requests
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for consultation_requests
CREATE POLICY "Users can insert their own consultation requests" 
ON public.consultation_requests 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their company's consultation requests" 
ON public.consultation_requests 
FOR SELECT 
USING (company_id = get_user_company_id());

CREATE POLICY "Users can update their company's consultation requests" 
ON public.consultation_requests 
FOR UPDATE 
USING (company_id = get_user_company_id());

-- Add new fields to onboarding_sessions
ALTER TABLE public.onboarding_sessions 
ADD COLUMN onboarding_type TEXT,
ADD COLUMN consultation_status TEXT,
ADD COLUMN meeting_scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN website_url TEXT,
ADD COLUMN knowledge_base_content JSONB DEFAULT '{}'::jsonb,
ADD COLUMN documents_uploaded JSONB DEFAULT '[]'::jsonb;

-- Create trigger for consultation_requests updated_at
CREATE TRIGGER update_consultation_requests_updated_at
BEFORE UPDATE ON public.consultation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();