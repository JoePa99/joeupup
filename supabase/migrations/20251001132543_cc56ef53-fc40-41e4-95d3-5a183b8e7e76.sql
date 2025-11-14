-- Create user_activities table for comprehensive activity tracking
CREATE TABLE IF NOT EXISTS public.user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  activity_category text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  target_resource_type text,
  target_resource_id uuid,
  status text DEFAULT 'completed',
  tags text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX idx_user_activities_company_id ON public.user_activities(company_id);
CREATE INDEX idx_user_activities_agent_id ON public.user_activities(agent_id);
CREATE INDEX idx_user_activities_created_at ON public.user_activities(created_at DESC);
CREATE INDEX idx_user_activities_activity_type ON public.user_activities(activity_type);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activities in their company"
  ON public.user_activities
  FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "System can insert activities"
  ON public.user_activities
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can insert their own activities"
  ON public.user_activities
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR company_id = get_user_company_id());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activities;