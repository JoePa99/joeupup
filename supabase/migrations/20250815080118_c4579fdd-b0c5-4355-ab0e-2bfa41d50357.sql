-- Complete Database Architecture Implementation
-- ===========================================

-- 1. CREATE ENUMS
-- ===============

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.company_plan AS ENUM ('basic', 'professional', 'enterprise');
CREATE TYPE public.agent_status AS ENUM ('active', 'training', 'inactive', 'paused');
CREATE TYPE public.playbook_status AS ENUM ('draft', 'in_progress', 'complete');
CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.document_type AS ENUM ('sop', 'contract', 'manual', 'policy', 'template', 'other');
CREATE TYPE public.agent_type AS ENUM ('sales', 'support', 'operations', 'hr', 'marketing', 'custom');

-- 2. CORE USER MANAGEMENT SYSTEM
-- ==============================

-- Companies table
CREATE TABLE public.companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    plan company_plan NOT NULL DEFAULT 'basic',
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role app_role NOT NULL DEFAULT 'user',
    settings JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User roles table
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role, company_id)
);

-- User companies junction table (for multi-company access)
CREATE TABLE public.user_companies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, company_id)
);

-- 3. KNOWLEDGE BASE SYSTEM
-- ========================

-- Document categories
CREATE TABLE public.document_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document archives
CREATE TABLE public.document_archives (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.document_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    storage_path TEXT NOT NULL,
    doc_type document_type NOT NULL DEFAULT 'other',
    tags TEXT[],
    version_number INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document versions
CREATE TABLE public.document_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.document_archives(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    changelog TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document access logs
CREATE TABLE public.document_access_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.document_archives(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'view', 'download', 'edit', 'delete'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Playbook sections
CREATE TABLE public.playbook_sections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    section_order INTEGER DEFAULT 0,
    status playbook_status NOT NULL DEFAULT 'draft',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    tags TEXT[],
    last_updated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. AI AGENT MANAGEMENT
-- =====================

-- Agent types
CREATE TABLE public.agent_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    default_avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agents
CREATE TABLE public.agents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    agent_type_id UUID REFERENCES public.agent_types(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    status agent_status NOT NULL DEFAULT 'training',
    configuration JSONB DEFAULT '{}',
    last_task TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent tags
CREATE TABLE public.agent_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, name)
);

-- Agent tag assignments
CREATE TABLE public.agent_tag_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.agent_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(agent_id, tag_id)
);

-- Agent metrics
CREATE TABLE public.agent_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    tasks_completed INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER DEFAULT 0,
    csat_rating DECIMAL(3,2) DEFAULT 0.00,
    total_conversations INTEGER DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(agent_id, date)
);

-- Agent conversations
CREATE TABLE public.agent_conversations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    session_id TEXT,
    messages JSONB DEFAULT '[]',
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. ONBOARDING & PROGRESS TRACKING
-- =================================

-- Onboarding steps
CREATE TABLE public.onboarding_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    step_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Onboarding sessions
CREATE TABLE public.onboarding_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 1,
    status onboarding_status NOT NULL DEFAULT 'not_started',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    completed_steps INTEGER[] DEFAULT '{}',
    session_data JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Company settings
CREATE TABLE public.company_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
    onboarding_completed BOOLEAN DEFAULT false,
    knowledge_source TEXT, -- 'website', 'documents', etc.
    website_url TEXT,
    branding JSONB DEFAULT '{}',
    integrations JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. ANALYTICS & KPI SYSTEM
-- =========================

-- KPI metrics
CREATE TABLE public.kpi_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    change_percentage DECIMAL(5,2) DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, metric_name, period_start, period_end)
);

-- Activity logs
CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Usage analytics
CREATE TABLE public.usage_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    user_id UUID REFERENCES public.profiles(id),
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Playbook activity
CREATE TABLE public.playbook_activity (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.playbook_sections(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. STORAGE BUCKETS
-- ==================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('documents', 'documents', false),
  ('avatars', 'avatars', true),
  ('company-logos', 'company-logos', true);

-- 8. ENABLE ROW LEVEL SECURITY
-- ============================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_activity ENABLE ROW LEVEL SECURITY;

-- 9. CREATE HELPER FUNCTIONS
-- ==========================

-- Function to get current user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. CREATE TRIGGERS
-- ===================

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updating timestamps
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_archives_updated_at
  BEFORE UPDATE ON public.document_archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playbook_sections_updated_at
  BEFORE UPDATE ON public.playbook_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_metrics_updated_at
  BEFORE UPDATE ON public.agent_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_sessions_updated_at
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. RLS POLICIES
-- ================

-- Companies policies
CREATE POLICY "Users can view their own company" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

CREATE POLICY "Users can update their own company" ON public.companies
  FOR UPDATE USING (id = public.get_user_company_id());

-- Profiles policies
CREATE POLICY "Users can view profiles in their company" ON public.profiles
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.get_user_role() = 'admin');

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- User roles policies
CREATE POLICY "Users can view roles in their company" ON public.user_roles
  FOR SELECT USING (company_id = public.get_user_company_id() OR public.get_user_role() = 'admin');

-- Document-related policies
CREATE POLICY "Users can view documents in their company" ON public.document_archives
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert documents in their company" ON public.document_archives
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update documents in their company" ON public.document_archives
  FOR UPDATE USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can view document categories in their company" ON public.document_categories
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Playbook policies
CREATE POLICY "Users can view playbook sections in their company" ON public.playbook_sections
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can update playbook sections in their company" ON public.playbook_sections
  FOR UPDATE USING (company_id = public.get_user_company_id());

-- Agent policies
CREATE POLICY "Users can view agents in their company" ON public.agents
  FOR SELECT USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage agents in their company" ON public.agents
  FOR ALL USING (company_id = public.get_user_company_id());

-- Agent metrics policies
CREATE POLICY "Users can view agent metrics in their company" ON public.agent_metrics
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE company_id = public.get_user_company_id()
    )
  );

-- Onboarding policies
CREATE POLICY "Users can view their onboarding session" ON public.onboarding_sessions
  FOR SELECT USING (user_id = auth.uid() OR company_id = public.get_user_company_id());

CREATE POLICY "Users can update their onboarding session" ON public.onboarding_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- KPI and analytics policies (admin access)
CREATE POLICY "Admins can view all KPI metrics" ON public.kpi_metrics
  FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "Users can view KPI metrics for their company" ON public.kpi_metrics
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Activity logs policies
CREATE POLICY "Users can view activity logs in their company" ON public.activity_logs
  FOR SELECT USING (company_id = public.get_user_company_id());

-- Agent types policies (global read access)
CREATE POLICY "Anyone can view agent types" ON public.agent_types
  FOR SELECT USING (true);

-- Onboarding steps policies (global read access)
CREATE POLICY "Anyone can view onboarding steps" ON public.onboarding_steps
  FOR SELECT USING (true);

-- 12. STORAGE POLICIES
-- ====================

-- Documents bucket policies
CREATE POLICY "Users can upload documents to their company folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "Users can view documents from their company folder" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

-- Avatars bucket policies
CREATE POLICY "Anyone can view avatar images" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Company logos bucket policies
CREATE POLICY "Anyone can view company logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their company logo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'company-logos' AND
    public.get_user_company_id()::text = (storage.foldername(name))[1]
  );

-- 13. INSERT DEFAULT DATA
-- =======================

-- Insert default agent types
INSERT INTO public.agent_types (name, description, default_avatar_url) VALUES
  ('sales', 'AI Sales Assistant for lead qualification and conversion', null),
  ('support', 'Customer Support AI for handling inquiries and issues', null),
  ('operations', 'Operations AI for process automation and optimization', null),
  ('hr', 'HR Assistant for employee onboarding and management', null),
  ('marketing', 'Marketing AI for content creation and campaign management', null),
  ('custom', 'Custom AI agent with specialized configuration', null);

-- Insert default onboarding steps
INSERT INTO public.onboarding_steps (step_number, title, description, is_required) VALUES
  (1, 'Company Basics', 'Set up your company profile and basic information', true),
  (2, 'Knowledge Source', 'Choose how to import your company knowledge', true),
  (3, 'Scan Results', 'Review and approve generated content', true),
  (4, 'Deploy AI Agents', 'Configure and deploy your AI agents', true);

-- 14. CREATE INDEXES FOR PERFORMANCE
-- ==================================

CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_agents_company_id ON public.agents(company_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_document_archives_company_id ON public.document_archives(company_id);
CREATE INDEX idx_document_archives_type ON public.document_archives(doc_type);
CREATE INDEX idx_playbook_sections_company_id ON public.playbook_sections(company_id);
CREATE INDEX idx_agent_metrics_agent_id ON public.agent_metrics(agent_id);
CREATE INDEX idx_agent_metrics_date ON public.agent_metrics(date);
CREATE INDEX idx_activity_logs_company_id ON public.activity_logs(company_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX idx_kpi_metrics_company_id ON public.kpi_metrics(company_id);
CREATE INDEX idx_onboarding_sessions_company_id ON public.onboarding_sessions(company_id);
CREATE INDEX idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);