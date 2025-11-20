-- Ensure the companies table exists for signup flows
-- This migration recreates the companies table if it was never created
-- and restores the RPC used during signup to avoid schema cache errors.

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure the company_plan enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'company_plan' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.company_plan AS ENUM ('basic', 'professional', 'enterprise');
  END IF;
END $$;

-- Create the companies table if it's missing
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  plan public.company_plan NOT NULL DEFAULT 'basic',
  logo_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill columns that may be missing on existing installs
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_name TEXT,
  ADD COLUMN IF NOT EXISTS purchased_seats INTEGER;

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_companies_set_updated_at ON public.companies;
CREATE TRIGGER trg_companies_set_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Ensure RLS is enabled
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create companies during signup
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to view their company or the one they created
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = public.get_user_company_id() OR created_by = auth.uid()
);

-- Helpful index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);

-- Recreate the signup RPC to bypass RLS safely
CREATE OR REPLACE FUNCTION public.create_company_and_link_profile(
  p_company_name TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  company_id UUID,
  company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  INSERT INTO public.companies (name, created_by)
  VALUES (p_company_name, p_user_id)
  RETURNING id INTO v_company_id;

  UPDATE public.profiles
  SET
    company_id = v_company_id,
    role = 'admin'
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_company_id, p_company_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_and_link_profile(TEXT, UUID) TO authenticated;
