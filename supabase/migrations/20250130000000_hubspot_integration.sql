-- Create HubSpot integrations table for storing OAuth tokens
CREATE TABLE public.hubspot_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  access_token TEXT, -- Will be encrypted via application layer
  refresh_token TEXT, -- Will be encrypted via application layer
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  contacts_enabled BOOLEAN NOT NULL DEFAULT false,
  companies_enabled BOOLEAN NOT NULL DEFAULT false,
  deals_enabled BOOLEAN NOT NULL DEFAULT false,
  tickets_enabled BOOLEAN NOT NULL DEFAULT false,
  workflows_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create HubSpot API usage logs table
CREATE TABLE public.hubspot_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  api_service TEXT NOT NULL, -- contacts, companies, deals, tickets
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  rate_limit_remaining INTEGER,
  quota_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create HubSpot contacts cache table
CREATE TABLE public.hubspot_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company_name TEXT,
  job_title TEXT,
  lifecycle_stage TEXT,
  lead_status TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hubspot_contact_id)
);

-- Create HubSpot companies cache table
CREATE TABLE public.hubspot_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  hubspot_company_id TEXT NOT NULL,
  name TEXT,
  domain TEXT,
  industry TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  phone TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hubspot_company_id)
);

-- Create HubSpot deals cache table
CREATE TABLE public.hubspot_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  hubspot_deal_id TEXT NOT NULL,
  deal_name TEXT,
  deal_stage TEXT,
  amount DECIMAL(15,2),
  currency TEXT,
  close_date TIMESTAMP WITH TIME ZONE,
  deal_type TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hubspot_deal_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.hubspot_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubspot_deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for hubspot_integrations
CREATE POLICY "Users can manage their own HubSpot integrations"
ON public.hubspot_integrations
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for hubspot_api_logs
CREATE POLICY "Users can view their own API logs"
ON public.hubspot_api_logs
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert API logs"
ON public.hubspot_api_logs
FOR INSERT
WITH CHECK (true);

-- Create RLS policies for hubspot_contacts
CREATE POLICY "Users can manage their HubSpot contacts"
ON public.hubspot_contacts
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for hubspot_companies
CREATE POLICY "Users can manage their HubSpot companies"
ON public.hubspot_companies
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for hubspot_deals
CREATE POLICY "Users can manage their HubSpot deals"
ON public.hubspot_deals
FOR ALL
USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_hubspot_integrations_user_company ON public.hubspot_integrations(user_id, company_id);
CREATE INDEX idx_hubspot_api_logs_user_service ON public.hubspot_api_logs(user_id, api_service, created_at);
CREATE INDEX idx_hubspot_contacts_user_email ON public.hubspot_contacts(user_id, email);
CREATE INDEX idx_hubspot_contacts_search ON public.hubspot_contacts(user_id, first_name, last_name, company_name);
CREATE INDEX idx_hubspot_companies_user_name ON public.hubspot_companies(user_id, name);
CREATE INDEX idx_hubspot_companies_search ON public.hubspot_companies(user_id, name, domain, industry);
CREATE INDEX idx_hubspot_deals_user_stage ON public.hubspot_deals(user_id, deal_stage);
CREATE INDEX idx_hubspot_deals_search ON public.hubspot_deals(user_id, deal_name, deal_type);

-- Create updated_at trigger function for HubSpot
CREATE OR REPLACE FUNCTION update_hubspot_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_hubspot_integrations_updated_at
    BEFORE UPDATE ON public.hubspot_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_hubspot_updated_at_column();



