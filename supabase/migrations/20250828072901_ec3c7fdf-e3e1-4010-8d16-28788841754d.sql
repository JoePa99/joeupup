-- Create Google integrations table for storing OAuth tokens
CREATE TABLE public.google_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  access_token TEXT, -- Will be encrypted via application layer
  refresh_token TEXT, -- Will be encrypted via application layer
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  gmail_enabled BOOLEAN NOT NULL DEFAULT false,
  drive_enabled BOOLEAN NOT NULL DEFAULT false,
  sheets_enabled BOOLEAN NOT NULL DEFAULT false,
  docs_enabled BOOLEAN NOT NULL DEFAULT false,
  calendar_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create Google API usage logs table
CREATE TABLE public.google_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  api_service TEXT NOT NULL, -- gmail, drive, sheets, docs, calendar
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  rate_limit_remaining INTEGER,
  quota_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Gmail messages cache table
CREATE TABLE public.gmail_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  subject TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipient_emails TEXT[],
  message_content TEXT,
  snippet TEXT,
  labels TEXT[],
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_important BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

-- Create Google Drive files cache table
CREATE TABLE public.google_drive_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  parent_folder_id TEXT,
  folder_path TEXT,
  content TEXT, -- For text-based files
  web_view_link TEXT,
  download_link TEXT,
  permissions JSONB DEFAULT '{}',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_time TIMESTAMP WITH TIME ZONE,
  modified_time TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, drive_file_id)
);

-- Create Google Sheets data cache table
CREATE TABLE public.google_sheets_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  range_notation TEXT,
  data_values JSONB NOT NULL DEFAULT '{}',
  last_modified TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, spreadsheet_id, sheet_name, range_notation)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for google_integrations
CREATE POLICY "Users can manage their own Google integrations"
ON public.google_integrations
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for google_api_logs
CREATE POLICY "Users can view their own API logs"
ON public.google_api_logs
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert API logs"
ON public.google_api_logs
FOR INSERT
WITH CHECK (true);

-- Create RLS policies for gmail_messages
CREATE POLICY "Users can manage their Gmail messages"
ON public.gmail_messages
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for google_drive_files
CREATE POLICY "Users can manage their Drive files"
ON public.google_drive_files
FOR ALL
USING (user_id = auth.uid());

-- Create RLS policies for google_sheets_data
CREATE POLICY "Users can manage their Sheets data"
ON public.google_sheets_data
FOR ALL
USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_google_integrations_user_company ON public.google_integrations(user_id, company_id);
CREATE INDEX idx_google_api_logs_user_service ON public.google_api_logs(user_id, api_service, created_at);
CREATE INDEX idx_gmail_messages_user_thread ON public.gmail_messages(user_id, thread_id);
CREATE INDEX idx_gmail_messages_search ON public.gmail_messages(user_id, subject, sender_email);
CREATE INDEX idx_drive_files_user_parent ON public.google_drive_files(user_id, parent_folder_id);
CREATE INDEX idx_drive_files_search ON public.google_drive_files(user_id, name, mime_type);
CREATE INDEX idx_sheets_data_user_sheet ON public.google_sheets_data(user_id, spreadsheet_id, sheet_name);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_google_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_google_integrations_updated_at
    BEFORE UPDATE ON public.google_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_google_updated_at_column();