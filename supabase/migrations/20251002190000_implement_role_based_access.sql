-- Add 'platform-admin' role to the role-based access control system
-- This migration implements a two-tier role system:
-- - 'admin': Company-level admin with full control over their company
-- - 'platform-admin': Platform-level admin with access to platform dashboard

-- Add 'platform-admin' to app_role enum (idempotent - only adds if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'app_role' AND e.enumlabel = 'platform-admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'platform-admin';
  END IF;
END $$;

-- Add function to check if user is company admin
CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id 
    AND company_id = _company_id 
    AND role IN ('admin', 'platform-admin')
  );
END;
$function$;

-- Add function to check if user is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id 
    AND role = 'platform-admin'
  );
END;
$function$;

-- Update RLS policies that should check for platform-admin instead of admin
-- Tools management (20250829054133)
DROP POLICY IF EXISTS "Admins can manage tools" ON public.tools;
DROP POLICY IF EXISTS "Platform admins can manage tools" ON public.tools;
CREATE POLICY "Platform admins can manage tools" 
ON public.tools 
FOR ALL 
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage agent tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Platform admins can manage agent tools" ON public.agent_tools;
CREATE POLICY "Platform admins can manage agent tools" 
ON public.agent_tools 
FOR ALL 
USING (is_platform_admin(auth.uid()));

-- Consultation messages (20250827184034, 20250827183313)
DROP POLICY IF EXISTS "Admins can manage all consultation messages" ON public.consultation_messages;
DROP POLICY IF EXISTS "Platform admins can manage all consultation messages" ON public.consultation_messages;
CREATE POLICY "Platform admins can manage all consultation messages" 
ON public.consultation_messages 
FOR ALL 
USING (is_platform_admin(auth.uid()));

-- Global agents management (20250827175448)
DROP POLICY IF EXISTS "Admins can manage agents" ON public.agents;
DROP POLICY IF EXISTS "Platform admins can manage agents" ON public.agents;
CREATE POLICY "Platform admins can manage agents" ON public.agents
FOR ALL USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage agent documents" ON public.agent_documents;
DROP POLICY IF EXISTS "Admins can update agent documents" ON public.agent_documents;
DROP POLICY IF EXISTS "Admins can delete agent documents" ON public.agent_documents;
DROP POLICY IF EXISTS "Platform admins can insert agent documents" ON public.agent_documents;
DROP POLICY IF EXISTS "Platform admins can update agent documents" ON public.agent_documents;
DROP POLICY IF EXISTS "Platform admins can delete agent documents" ON public.agent_documents;

CREATE POLICY "Platform admins can insert agent documents" ON public.agent_documents
FOR INSERT WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update agent documents" ON public.agent_documents
FOR UPDATE USING (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete agent documents" ON public.agent_documents
FOR DELETE USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage agent tag assignments" ON public.agent_tag_assignments;
DROP POLICY IF EXISTS "Platform admins can manage agent tag assignments" ON public.agent_tag_assignments;
CREATE POLICY "Platform admins can manage agent tag assignments" ON public.agent_tag_assignments
FOR ALL USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage agent tags" ON public.agent_tags;
DROP POLICY IF EXISTS "Platform admins can manage agent tags" ON public.agent_tags;
CREATE POLICY "Platform admins can manage agent tags" ON public.agent_tags
FOR ALL USING (is_platform_admin(auth.uid()));

-- Profiles view policy (20250815080118:458)
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;
CREATE POLICY "Users can view profiles in their company" ON public.profiles
  FOR SELECT USING (
    company_id = public.get_user_company_id() 
    OR is_platform_admin(auth.uid())
  );

-- User roles policy (20250815080118:468)
DROP POLICY IF EXISTS "Users can view roles in their company" ON public.user_roles;
CREATE POLICY "Users can view roles in their company" ON public.user_roles
  FOR SELECT USING (
    company_id = public.get_user_company_id() 
    OR is_platform_admin(auth.uid())
  );

-- KPI metrics policy (20250815080118:514)
DROP POLICY IF EXISTS "Admins can view all KPI metrics" ON public.kpi_metrics;
DROP POLICY IF EXISTS "Platform admins can view all KPI metrics" ON public.kpi_metrics;
CREATE POLICY "Platform admins can view all KPI metrics" ON public.kpi_metrics
  FOR SELECT USING (is_platform_admin(auth.uid()));

-- Consultation communication storage policies (20250125000000)
-- Update storage policies for consultation-documents bucket
DROP POLICY IF EXISTS "Admins can read all consultation documents" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can read all consultation documents" ON storage.objects;
CREATE POLICY "Platform admins can read all consultation documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'consultation-documents' 
    AND is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can upload consultation documents" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can upload consultation documents" ON storage.objects;
CREATE POLICY "Platform admins can upload consultation documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'consultation-documents' 
    AND is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete consultation documents" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can delete consultation documents" ON storage.objects;
CREATE POLICY "Platform admins can delete consultation documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'consultation-documents' 
    AND is_platform_admin(auth.uid())
);

-- Team invitations policy (20251002120000)
DROP POLICY IF EXISTS "Admins can delete any invitation" ON team_invitations;
DROP POLICY IF EXISTS "Company admins and platform admins can delete invitations" ON team_invitations;
CREATE POLICY "Company admins and platform admins can delete invitations" 
ON team_invitations
FOR DELETE
USING (
  invited_by = auth.uid() OR
  is_company_admin(auth.uid(), team_invitations.company_id) OR
  is_platform_admin(auth.uid())
);

