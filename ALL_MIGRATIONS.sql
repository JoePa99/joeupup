-- ============================================================================
-- Migration: 20250106150000_provision_openai_for_company_agents.sql
-- ============================================================================

-- Provision OpenAI resources for company agents after seeding
-- This migration updates seeding functions to automatically provision OpenAI assistant and vector store
-- for each cloned company agent to ensure they have isolated knowledge bases

-- Enable http extension if not already enabled (needed to call edge functions from triggers)
CREATE EXTENSION IF NOT EXISTS http;

-- Create a helper function to call the provision edge function
CREATE OR REPLACE FUNCTION public.provision_agent_openai_resources(
  p_agent_id uuid,
  p_company_id uuid,
  p_agent_name text,
  p_agent_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_response json;
  v_result json;
BEGIN
  -- Call the provision-company-agent-openai edge function
  SELECT content::json INTO v_response
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/provision-company-agent-openai',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_key')),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'agent_id', p_agent_id::text,
      'company_id', p_company_id::text,
      'agent_name', p_agent_name,
      'agent_description', COALESCE(p_agent_description, '')
    )::text
  ));

  -- Check if the response indicates success
  IF (v_response->>'success')::boolean THEN
    RETURN json_build_object('success', true, 'data', v_response->'data');
  ELSE
    RAISE WARNING 'Failed to provision OpenAI resources for agent %: %', p_agent_name, v_response->>'error';
    RETURN json_build_object('success', false, 'error', v_response->>'error');
  END IF;
END;
$function$;

-- Update seed_default_agents_for_company() to provision OpenAI resources after cloning
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_record RECORD;
  v_provision_result json;
BEGIN
  -- Clone template agents to the new company
  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default,
    system_instructions
  )
  SELECT 
    NEW.id,  -- New company's ID
    template.agent_type_id, 
    template.name, 
    template.role,
    template.description, 
    template.configuration, 
    template.status, 
    auth.uid(),
    false,  -- Cloned agents are NOT default, only templates are
    template.system_instructions  -- Copy system instructions from template
  FROM public.agents template
  WHERE template.is_default = TRUE 
    AND template.company_id IS NULL  -- Template agents
    AND NOT EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = NEW.id 
      AND a.agent_type_id = template.agent_type_id
    )
  RETURNING id, name, description INTO v_agent_record;

  -- Provision OpenAI resources for the cloned agent
  IF FOUND THEN
    v_provision_result := public.provision_agent_openai_resources(
      v_agent_record.id,
      NEW.id,
      v_agent_record.name,
      v_agent_record.description
    );
    
    IF NOT (v_provision_result->>'success')::boolean THEN
      RAISE WARNING 'Failed to provision OpenAI resources for agent % in new company %: %', 
        v_agent_record.name, NEW.id, v_provision_result->>'error';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update copy_default_agent_to_company() to provision OpenAI resources
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(
  p_default_agent_id uuid, 
  p_company_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_template RECORD;
  v_provision_result json;
BEGIN
  -- Authorization check
  IF NOT public.is_platform_admin() THEN
    -- Check if user is company admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Get template agent (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents 
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback to default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, 
      description, configuration, status, created_by, is_default
    )
    SELECT 
      p_company_id, da.agent_type_id, da.name, at.name,
      da.description, da.config, 
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(), false  -- Cloned agents are NOT default
    FROM public.default_agents da
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE da.id = p_default_agent_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agents a 
        WHERE a.company_id = p_company_id 
        AND a.agent_type_id = da.agent_type_id
      )
    RETURNING id INTO v_id;
    
    -- Return existing if already exists
    IF v_id IS NULL THEN
      SELECT a.id INTO v_id 
      FROM public.agents a 
      JOIN public.default_agents da ON da.agent_type_id = a.agent_type_id
      WHERE da.id = p_default_agent_id
        AND a.company_id = p_company_id 
      LIMIT 1;
    END IF;
  ELSE
    -- Check if agent type already exists for this company
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
      AND a.agent_type_id = v_template.agent_type_id 
    LIMIT 1;
    
    -- Clone from agents table if doesn't exist
    IF v_id IS NULL THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, v_template.agent_type_id, v_template.name, v_template.role,
        v_template.description, v_template.configuration, v_template.status,
        auth.uid(), false, v_template.system_instructions  -- Cloned agents are NOT default, copy system_instructions
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;
  
  -- Provision OpenAI resources for the cloned agent if it was just created
  IF v_id IS NOT NULL THEN
    -- Check if agent already has OpenAI configuration
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE id = v_id 
      AND assistant_id IS NOT NULL 
      AND vector_store_id IS NOT NULL
    ) THEN
      -- Get agent details for provisioning
      SELECT name, description INTO v_template
      FROM public.agents 
      WHERE id = v_id;
      
      v_provision_result := public.provision_agent_openai_resources(
        v_id,
        p_company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI resources for agent % in company %: %', 
          v_template.name, p_company_id, v_provision_result->>'error';
      END IF;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies() to provision OpenAI resources
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(
  p_default_agent_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_template RECORD;
  v_company RECORD;
  v_provision_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;

  -- Try to get template from agents table (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback: try default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default
    )
    SELECT
      c.id,
      da.agent_type_id,
      da.name,
      at.name as role,
      da.description,
      da.config as configuration,
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(),
      false  -- Cloned agents are NOT default
    FROM public.companies c
    JOIN public.default_agents da ON da.id = p_default_agent_id
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = da.agent_type_id
    );
  ELSE
    -- Clone template from agents table to all companies
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default, system_instructions
    )
    SELECT
      c.id,
      v_template.agent_type_id,
      v_template.name,
      v_template.role,
      v_template.description,
      v_template.configuration,
      v_template.status,
      auth.uid(),
      false,  -- Cloned agents are NOT default, only templates are
      v_template.system_instructions  -- Copy system instructions from template
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = v_template.agent_type_id
    );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Provision OpenAI resources for all newly created agents
  IF v_count > 0 THEN
    -- Get the template name and description
    IF v_template IS NULL THEN
      SELECT da.name, da.description INTO v_template
      FROM public.default_agents da
      WHERE da.id = p_default_agent_id;
    END IF;
    
    -- Provision resources for each newly created agent
    FOR v_company IN (
      SELECT DISTINCT a.id as agent_id, a.company_id, c.name as company_name
      FROM public.agents a
      JOIN public.companies c ON c.id = a.company_id
      WHERE a.created_by = auth.uid()
        AND a.created_at > NOW() - INTERVAL '1 minute'  -- Recently created
        AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)
    ) LOOP
      v_provision_result := public.provision_agent_openai_resources(
        v_company.agent_id,
        v_company.company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI resources for agent % in company %: %', 
          v_template.name, v_company.company_name, v_provision_result->>'error';
      END IF;
    END LOOP;
  END IF;

  RETURN v_count;
END;
$function$;


-- ============================================================================
-- Migration: 20250106160000_backfill_existing_agents.sql
-- ============================================================================

-- Backfill existing agents with OpenAI configuration
-- This migration documents the process for running the backfill function
-- to provision OpenAI resources for existing company agents that are missing them

-- Note: This migration does not automatically run the backfill
-- The backfill must be triggered manually via API call to the edge function
-- This is intentional to allow for controlled execution and monitoring

-- Create a helper function to check which agents need backfill
CREATE OR REPLACE FUNCTION public.get_agents_needing_openai_config()
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  company_name text,
  company_id uuid,
  missing_assistant_id boolean,
  missing_vector_store_id boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id as agent_id,
    a.name as agent_name,
    c.name as company_name,
    a.company_id,
    (a.assistant_id IS NULL) as missing_assistant_id,
    (a.vector_store_id IS NULL) as missing_vector_store_id
  FROM public.agents a
  JOIN public.companies c ON c.id = a.company_id
  WHERE a.company_id IS NOT NULL  -- Only company agents
    AND a.status = 'active'       -- Only active agents
    AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)  -- Missing OpenAI config
  ORDER BY c.name, a.name;
$$;

-- Create a view for easier monitoring of agent OpenAI configuration status
CREATE OR REPLACE VIEW public.agent_openai_status AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  c.name as company_name,
  a.company_id,
  a.status,
  CASE 
    WHEN a.assistant_id IS NOT NULL AND a.vector_store_id IS NOT NULL THEN 'configured'
    WHEN a.assistant_id IS NULL AND a.vector_store_id IS NULL THEN 'missing_both'
    WHEN a.assistant_id IS NULL THEN 'missing_assistant'
    WHEN a.vector_store_id IS NULL THEN 'missing_vector_store'
    ELSE 'partial'
  END as openai_status,
  a.assistant_id,
  a.vector_store_id,
  a.created_at,
  a.updated_at
FROM public.agents a
LEFT JOIN public.companies c ON c.id = a.company_id
WHERE a.company_id IS NOT NULL  -- Only company agents
ORDER BY c.name, a.name;

-- Grant appropriate permissions
GRANT SELECT ON public.agent_openai_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_needing_openai_config() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_agents_needing_openai_config() IS 
'Returns all company agents that are missing OpenAI assistant_id or vector_store_id configuration';

COMMENT ON VIEW public.agent_openai_status IS 
'Shows the OpenAI configuration status for all company agents';

-- Create an index to optimize queries for agents needing configuration
CREATE INDEX IF NOT EXISTS idx_agents_missing_openai_config 
ON public.agents (company_id, status) 
WHERE company_id IS NOT NULL 
  AND (assistant_id IS NULL OR vector_store_id IS NULL);

/*
=== MANUAL BACKFILL INSTRUCTIONS ===

To backfill existing agents with OpenAI configuration, you need to call the edge function manually:

1. First, check which agents need backfill:
   SELECT * FROM public.get_agents_needing_openai_config();

2. Run a dry-run to see what would be processed:
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": true,
     "limit": 10
   }

3. Run the actual backfill (start with small batches):
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": false,
     "limit": 5
   }

4. Monitor progress using the view:
   SELECT * FROM public.agent_openai_status 
   WHERE openai_status != 'configured';

5. Continue with larger batches once confirmed working:
   POST /functions/v1/backfill-agent-openai
   {
     "dry_run": false,
     "limit": 20
   }

Notes:
- The backfill function processes agents in batches to avoid timeouts
- Each agent gets its own unique OpenAI assistant and vector store
- Failed agents will be logged with error details
- You can monitor the agent_openai_status view to track progress
- The process is idempotent - running it multiple times is safe

Expected outcome:
- All company agents will have assistant_id and vector_store_id populated
- Document uploads to agent knowledge bases will work correctly
- Each company will have isolated knowledge bases per agent type
*/


-- ============================================================================
-- Migration: 20250107000000_fix_company_creation_rls.sql
-- ============================================================================

-- Fix Company Creation RLS Policy
-- ================================
-- This migration fixes the "query returned more than one row" error during signup
-- by adding created_by column and updating RLS policies

-- 1. Add created_by column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update existing companies to have created_by set to first admin user from each company
-- This is a best-effort backfill - some companies may not have created_by set
UPDATE public.companies 
SET created_by = (
  SELECT p.id 
  FROM public.profiles p 
  WHERE p.company_id = public.companies.id 
    AND p.role = 'admin' 
  LIMIT 1
)
WHERE created_by IS NULL;

-- 3. Add RLS policy to allow users to SELECT companies they created
-- This is needed during signup when profile.company_id is not yet set
CREATE POLICY "Users can view companies they create"
ON public.companies
FOR SELECT
USING (created_by = auth.uid());

-- 4. Add RLS policy to allow users to SELECT companies they belong to (existing logic)
-- Keep the existing policy but make it more permissive for the created_by case
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = public.get_user_company_id() 
  OR created_by = auth.uid()
);

-- 5. Update INSERT policy to include created_by
-- The existing INSERT policy should remain, but we'll ensure created_by is set
-- This is handled in the application code

-- 6. Add index for performance on created_by lookups
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);


-- ============================================================================
-- Migration: 20250107000002_create_company_bypass_rls.sql
-- ============================================================================

 

-- ============================================================================
-- Migration: 20250107000003_fix_company_creation_with_rpc.sql
-- ============================================================================

-- Fix Company Creation Error with RPC Function
-- ==============================================
-- This migration creates an RPC function that handles company creation and profile linking
-- atomically, bypassing RLS issues during signup

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
  -- Insert company
  INSERT INTO public.companies (name)
  VALUES (p_company_name)
  RETURNING id INTO v_company_id;
  
  -- Update profile immediately with company_id and admin role
  UPDATE public.profiles
  SET 
    company_id = v_company_id, 
    role = 'admin'
  WHERE id = p_user_id;
  
  -- Return company data
  RETURN QUERY SELECT v_company_id, p_company_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_and_link_profile(TEXT, UUID) TO authenticated;


-- ============================================================================
-- Migration: 20250110150000_add_stripe_and_usage_tracking.sql
-- ============================================================================

-- Stripe Payment & Usage Tracking Schema
-- ========================================

-- Add Stripe fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'trialing', 'past_due', 'canceled', 'unpaid')),
ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP WITH TIME ZONE;

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly INTEGER NOT NULL, -- Price in cents
    message_limit_per_seat INTEGER NOT NULL,
    seat_limit INTEGER, -- NULL means unlimited
    features JSONB DEFAULT '[]'::jsonb,
    stripe_price_id TEXT NOT NULL UNIQUE,
    stripe_product_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on plan slug for fast lookups
CREATE INDEX idx_subscription_plans_slug ON public.subscription_plans(slug);
CREATE INDEX idx_subscription_plans_active ON public.subscription_plans(is_active) WHERE is_active = true;

-- Add plan_id to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id);

-- Create user_usage table to track per-user message consumption
CREATE TABLE IF NOT EXISTS public.user_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    messages_used INTEGER NOT NULL DEFAULT 0,
    messages_limit INTEGER NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, period_start)
);

-- Create indexes for user_usage
CREATE INDEX idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX idx_user_usage_company_id ON public.user_usage(company_id);
CREATE INDEX idx_user_usage_period ON public.user_usage(period_start, period_end);

-- Create usage_history table to maintain monthly usage records
CREATE TABLE IF NOT EXISTS public.usage_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    messages_used INTEGER NOT NULL,
    messages_limit INTEGER NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for usage_history
CREATE INDEX idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX idx_usage_history_company_id ON public.usage_history(company_id);
CREATE INDEX idx_usage_history_period ON public.usage_history(period_start, period_end);
CREATE INDEX idx_usage_history_archived ON public.usage_history(archived_at);

-- Insert default subscription plans (prices in cents)
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, message_limit_per_seat, seat_limit, stripe_price_id, stripe_product_id, features, display_order) VALUES
(
    'Starter',
    'starter',
    'Perfect for small teams getting started with AI agents',
    5900, -- $59.00
    50,
    5,
    'price_starter_placeholder', -- Replace with actual Stripe price ID
    'prod_starter_placeholder', -- Replace with actual Stripe product ID
    '["Email support", "Basic features", "Up to 5 seats", "50 messages per seat"]'::jsonb,
    1
),
(
    'Professional',
    'professional',
    'For growing teams that need advanced features',
    29900, -- $299.00
    250,
    25,
    'price_professional_placeholder', -- Replace with actual Stripe price ID
    'prod_professional_placeholder', -- Replace with actual Stripe product ID
    '["Priority support", "Advanced features", "Channels & integrations", "Up to 25 seats", "250 messages per seat"]'::jsonb,
    2
),
(
    'Enterprise',
    'enterprise',
    'For large organizations with custom needs',
    119900, -- $1,199.00
    1000,
    NULL, -- Unlimited seats
    'price_enterprise_placeholder', -- Replace with actual Stripe price ID
    'prod_enterprise_placeholder', -- Replace with actual Stripe product ID
    '["Dedicated support", "Custom integrations", "SLA guarantees", "Unlimited seats", "1000 messages per seat"]'::jsonb,
    3
);

-- Enable RLS on new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active subscription plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_active = true);

-- RLS Policies for user_usage
CREATE POLICY "Users can view their own usage" 
ON public.user_usage 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Company admins can view all company usage" 
ON public.user_usage 
FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- System can insert/update usage (via service role)
CREATE POLICY "Service role can manage usage" 
ON public.user_usage 
FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for usage_history
CREATE POLICY "Users can view their own usage history" 
ON public.usage_history 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Company admins can view all company usage history" 
ON public.usage_history 
FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- System can insert usage history (via service role)
CREATE POLICY "Service role can manage usage history" 
ON public.usage_history 
FOR ALL 
USING (auth.jwt()->>'role' = 'service_role');

-- Add trigger to update updated_at on subscription_plans
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger to update updated_at on user_usage
CREATE TRIGGER update_user_usage_updated_at
BEFORE UPDATE ON public.user_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.subscription_plans IS 'Subscription plan configurations with Stripe integration';
COMMENT ON TABLE public.user_usage IS 'Per-user message usage tracking for current billing period';
COMMENT ON TABLE public.usage_history IS 'Historical archive of user message usage by billing period';
COMMENT ON COLUMN public.companies.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.companies.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN public.companies.subscription_status IS 'Current subscription status from Stripe';








-- ============================================================================
-- Migration: 20250110150001_usage_tracking_triggers.sql
-- ============================================================================

-- Usage Tracking Triggers
-- ======================

-- Function to check if user has remaining messages before allowing chat
CREATE OR REPLACE FUNCTION check_user_message_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_usage RECORD;
    v_company_status TEXT;
BEGIN
    -- Only track user messages (not assistant responses)
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    -- Get user_id from conversation or channel
    DECLARE
        v_user_id UUID;
        v_company_id UUID;
    BEGIN
        IF NEW.conversation_id IS NOT NULL THEN
            -- Get user_id from conversation
            SELECT user_id, company_id INTO v_user_id, v_company_id
            FROM public.chat_conversations
            WHERE id = NEW.conversation_id;
        ELSIF NEW.channel_id IS NOT NULL THEN
            -- For channel messages, we need to get the user from somewhere
            -- Assuming there's a way to track who sent the message
            -- This might need adjustment based on your channel implementation
            RETURN NEW; -- For now, skip channels
        ELSE
            RETURN NEW;
        END IF;

        -- Check company subscription status
        SELECT subscription_status INTO v_company_status
        FROM public.companies
        WHERE id = v_company_id;

        -- Only enforce limits if subscription is not active
        IF v_company_status != 'active' AND v_company_status != 'trialing' THEN
            RAISE EXCEPTION 'Subscription is not active. Please update your billing information.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Get current usage for this user
        SELECT * INTO v_user_usage
        FROM public.user_usage
        WHERE user_id = v_user_id
        AND period_start <= NOW()
        AND period_end >= NOW()
        ORDER BY created_at DESC
        LIMIT 1;

        -- If no usage record exists, something is wrong
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No usage record found for user. Please contact support.'
                USING ERRCODE = 'P0002';
        END IF;

        -- Check if user has exceeded their limit
        IF v_user_usage.messages_used >= v_user_usage.messages_limit THEN
            RAISE EXCEPTION 'Message limit exceeded. You have used % of % messages. Please upgrade your plan or wait for the next billing period.', v_user_usage.messages_used, v_user_usage.messages_limit
                USING ERRCODE = 'P0003';
        END IF;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter after message is created
CREATE OR REPLACE FUNCTION increment_user_message_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- Only track user messages (not assistant responses)
    IF NEW.role != 'user' THEN
        RETURN NEW;
    END IF;

    -- Get user_id from conversation or channel
    IF NEW.conversation_id IS NOT NULL THEN
        SELECT user_id, company_id INTO v_user_id, v_company_id
        FROM public.chat_conversations
        WHERE id = NEW.conversation_id;
        
        -- Increment the usage counter
        UPDATE public.user_usage
        SET 
            messages_used = messages_used + 1,
            updated_at = NOW()
        WHERE user_id = v_user_id
        AND period_start <= NOW()
        AND period_end >= NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to check message limit BEFORE insert
CREATE TRIGGER check_message_limit_trigger
BEFORE INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION check_user_message_limit();

-- Create trigger to increment usage AFTER insert
CREATE TRIGGER increment_usage_trigger
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION increment_user_message_usage();

-- Function to initialize usage for a new user
CREATE OR REPLACE FUNCTION initialize_user_usage(
    p_user_id UUID,
    p_company_id UUID,
    p_message_limit INTEGER,
    p_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month')
)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
BEGIN
    INSERT INTO public.user_usage (
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    ) VALUES (
        p_user_id,
        p_company_id,
        0,
        p_message_limit,
        p_period_start,
        p_period_end
    )
    RETURNING id INTO v_usage_id;

    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly usage and archive history
CREATE OR REPLACE FUNCTION reset_monthly_usage(p_company_id UUID)
RETURNS TABLE(users_reset INTEGER, records_archived INTEGER) AS $$
DECLARE
    v_users_reset INTEGER := 0;
    v_records_archived INTEGER := 0;
BEGIN
    -- Archive current usage to history
    INSERT INTO public.usage_history (
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    )
    SELECT 
        user_id,
        company_id,
        messages_used,
        messages_limit,
        period_start,
        period_end
    FROM public.user_usage
    WHERE company_id = p_company_id
    AND period_end < NOW();

    GET DIAGNOSTICS v_records_archived = ROW_COUNT;

    -- Reset usage for all users in the company
    UPDATE public.user_usage
    SET 
        messages_used = 0,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '1 month',
        updated_at = NOW()
    WHERE company_id = p_company_id
    AND period_end < NOW();

    GET DIAGNOSTICS v_users_reset = ROW_COUNT;

    RETURN QUERY SELECT v_users_reset, v_records_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage for a user
CREATE OR REPLACE FUNCTION get_user_current_usage(p_user_id UUID)
RETURNS TABLE(
    messages_used INTEGER,
    messages_limit INTEGER,
    messages_remaining INTEGER,
    usage_percentage NUMERIC,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uu.messages_used,
        uu.messages_limit,
        (uu.messages_limit - uu.messages_used) as messages_remaining,
        ROUND((uu.messages_used::NUMERIC / NULLIF(uu.messages_limit, 0)::NUMERIC * 100), 2) as usage_percentage,
        uu.period_start,
        uu.period_end
    FROM public.user_usage uu
    WHERE uu.user_id = p_user_id
    AND uu.period_start <= NOW()
    AND uu.period_end >= NOW()
    ORDER BY uu.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company-wide usage stats (admin only)
CREATE OR REPLACE FUNCTION get_company_usage_stats(p_company_id UUID)
RETURNS TABLE(
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    messages_used INTEGER,
    messages_limit INTEGER,
    usage_percentage NUMERIC,
    last_message_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Check if requesting user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND company_id = p_company_id
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only company admins can view company-wide usage'
            USING ERRCODE = 'P0004';
    END IF;

    RETURN QUERY
    SELECT 
        uu.user_id,
        p.email,
        COALESCE(p.first_name || ' ' || p.last_name, p.email) as user_name,
        uu.messages_used,
        uu.messages_limit,
        ROUND((uu.messages_used::NUMERIC / NULLIF(uu.messages_limit, 0)::NUMERIC * 100), 2) as usage_percentage,
        (
            SELECT MAX(cm.created_at)
            FROM public.chat_messages cm
            JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
            WHERE cc.user_id = uu.user_id
            AND cm.role = 'user'
        ) as last_message_at
    FROM public.user_usage uu
    JOIN public.profiles p ON uu.user_id = p.id
    WHERE uu.company_id = p_company_id
    AND uu.period_start <= NOW()
    AND uu.period_end >= NOW()
    ORDER BY uu.messages_used DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION check_user_message_limit() IS 'Trigger function to verify user has not exceeded message limit before creating a message';
COMMENT ON FUNCTION increment_user_message_usage() IS 'Trigger function to increment message usage counter after message creation';
COMMENT ON FUNCTION initialize_user_usage(UUID, UUID, INTEGER, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Initialize usage tracking for a new user';
COMMENT ON FUNCTION reset_monthly_usage(UUID) IS 'Archive current usage and reset counters for monthly billing cycle';
COMMENT ON FUNCTION get_user_current_usage(UUID) IS 'Get current usage statistics for a specific user';
COMMENT ON FUNCTION get_company_usage_stats(UUID) IS 'Get usage statistics for all users in a company (admin only)';



-- ============================================================================
-- Migration: 20250110150002_add_seat_tracking.sql
-- ============================================================================

-- Add Seat Tracking to Companies
-- ==============================

-- Add purchased_seats column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS purchased_seats INTEGER DEFAULT 1;

-- Add index for seat tracking
CREATE INDEX IF NOT EXISTS idx_companies_seats ON public.companies(purchased_seats);

-- Function to get active user count for a company
CREATE OR REPLACE FUNCTION get_company_active_users(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT id) INTO v_count
  FROM public.profiles
  WHERE company_id = p_company_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if company has available seats
CREATE OR REPLACE FUNCTION has_available_seats(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_users INTEGER;
  v_purchased_seats INTEGER;
BEGIN
  -- Get active user count
  SELECT COUNT(DISTINCT id) INTO v_active_users
  FROM public.profiles
  WHERE company_id = p_company_id;
  
  -- Get purchased seats
  SELECT purchased_seats INTO v_purchased_seats
  FROM public.companies
  WHERE id = p_company_id;
  
  -- Return true if there are available seats
  RETURN (v_active_users < v_purchased_seats);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for seat usage statistics
CREATE OR REPLACE VIEW company_seat_usage AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.purchased_seats,
  COUNT(DISTINCT p.id) as active_users,
  (c.purchased_seats - COUNT(DISTINCT p.id)) as available_seats,
  ROUND((COUNT(DISTINCT p.id)::NUMERIC / NULLIF(c.purchased_seats, 0)::NUMERIC * 100), 2) as usage_percentage
FROM public.companies c
LEFT JOIN public.profiles p ON p.company_id = c.id
GROUP BY c.id, c.name, c.purchased_seats;

-- Grant access to the view
GRANT SELECT ON company_seat_usage TO authenticated;
GRANT SELECT ON company_seat_usage TO service_role;

-- Add helpful comments
COMMENT ON COLUMN public.companies.purchased_seats IS 'Number of seats purchased in subscription plan';
COMMENT ON FUNCTION get_company_active_users(UUID) IS 'Get count of active users in a company';
COMMENT ON FUNCTION has_available_seats(UUID) IS 'Check if company has available seats for new members';
COMMENT ON VIEW company_seat_usage IS 'Real-time view of seat usage across all companies';



-- ============================================================================
-- Migration: 20250110160000_add_playbook_unique_constraint.sql
-- ============================================================================

-- Add unique constraint on playbook_sections for (company_id, title)
-- This allows upsert operations when populating playbooks from website analysis

ALTER TABLE public.playbook_sections 
ADD CONSTRAINT unique_company_playbook_section 
UNIQUE (company_id, title);




































-- ============================================================================
-- Migration: 20250114000000_create_company_os_table.sql
-- ============================================================================

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



-- ============================================================================
-- Migration: 20250120000000_add_agent_chain_support.sql
-- ============================================================================

-- Add agent chain support to chat_messages table
-- This enables sequential agent processing where multiple agents can be tagged in one message

-- Add agent_chain column to store list of agents to process
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS agent_chain uuid[] DEFAULT '{}';

-- Add chain_index to track position in chain (0 = first agent, 1 = second, etc.)
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS chain_index integer DEFAULT NULL;

-- Add parent_message_id to link chained responses
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_chain ON public.chat_messages USING GIN(agent_chain);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chain_index ON public.chat_messages(chain_index);
CREATE INDEX IF NOT EXISTS idx_chat_messages_parent_message_id ON public.chat_messages(parent_message_id);

-- Add comments
COMMENT ON COLUMN public.chat_messages.agent_chain IS 'Array of agent IDs to process sequentially after current agent';
COMMENT ON COLUMN public.chat_messages.chain_index IS 'Position in the agent chain (0-indexed). NULL for non-chain messages';
COMMENT ON COLUMN public.chat_messages.parent_message_id IS 'Links to the original user message that started the chain';










-- ============================================================================
-- Migration: 20250120000000_add_google_drive_folder_to_companies.sql
-- ============================================================================

-- Add Google Drive folder integration to companies table
-- This allows companies to link a Google Drive folder for document browsing

ALTER TABLE public.companies
ADD COLUMN google_drive_folder_id TEXT,
ADD COLUMN google_drive_folder_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.google_drive_folder_id IS 'Google Drive folder ID for company-wide document access';
COMMENT ON COLUMN public.companies.google_drive_folder_name IS 'Display name of the linked Google Drive folder';

-- Create index for faster lookups
CREATE INDEX idx_companies_google_drive_folder ON public.companies(google_drive_folder_id) WHERE google_drive_folder_id IS NOT NULL;
















-- ============================================================================
-- Migration: 20250120000000_add_openai_file_tracking.sql
-- ============================================================================

-- Add OpenAI file tracking columns to agent_documents table
ALTER TABLE public.agent_documents 
ADD COLUMN openai_file_id text,
ADD COLUMN vector_store_file_id text,
ADD COLUMN added_at timestamp with time zone DEFAULT now();

-- Create index for faster lookups by OpenAI file ID
CREATE INDEX IF NOT EXISTS idx_agent_documents_openai_file_id ON public.agent_documents(openai_file_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_vector_store_file_id ON public.agent_documents(vector_store_file_id);


-- ============================================================================
-- Migration: 20250120000000_cleanup_duplicate_agents.sql
-- ============================================================================

-- Clean up duplicate agents created during onboarding
-- This migration removes duplicate agents that were created due to multiple calls to create-agent-indexes

-- First, let's identify and log duplicate agents for debugging
DO $$
DECLARE
    company_record RECORD;
    agent_record RECORD;
    duplicate_count INTEGER;
BEGIN
    -- Log companies with potential duplicate agents
    FOR company_record IN 
        SELECT company_id, COUNT(*) as agent_count
        FROM agents 
        WHERE status = 'active'
        GROUP BY company_id 
        HAVING COUNT(*) > 3  -- Assuming normal case has 3 agents per company
    LOOP
        RAISE NOTICE 'Company % has % agents (potential duplicates)', company_record.company_id, company_record.agent_count;
    END LOOP;
END $$;

-- Remove duplicate agents based on company_id and agent_type_id
-- Keep the first created agent of each type per company
DELETE FROM agents 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY company_id, agent_type_id 
                   ORDER BY created_at ASC
               ) as rn
        FROM agents 
        WHERE status = 'active'
    ) ranked
    WHERE rn > 1
);

-- Clean up orphaned chat conversations for deleted agents
DELETE FROM chat_conversations 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned channel agents for deleted agents
DELETE FROM channel_agents 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent conversations for deleted agents
DELETE FROM agent_conversations 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent metrics for deleted agents
DELETE FROM agent_metrics 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent tag assignments for deleted agents
DELETE FROM agent_tag_assignments 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Add a unique constraint to prevent future duplicates
-- This will ensure only one active agent per agent_type per company
ALTER TABLE agents 
ADD CONSTRAINT unique_agent_type_per_company 
UNIQUE (company_id, agent_type_id, status);

-- Log the cleanup results
DO $$
DECLARE
    total_agents INTEGER;
    companies_with_agents INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_agents FROM agents WHERE status = 'active';
    SELECT COUNT(DISTINCT company_id) INTO companies_with_agents FROM agents WHERE status = 'active';
    
    RAISE NOTICE 'Cleanup complete: % active agents across % companies', total_agents, companies_with_agents;
END $$;



-- ============================================================================
-- Migration: 20250120000001_company_scoped_agents.sql
-- ============================================================================

-- Company-scoped Agents Migration
-- ================================

-- 1) Platform admin authorization helpers
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id)
);

create or replace function public.is_platform_admin()
returns boolean
language sql stable as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- 2) Default catalog table
create table if not exists public.default_agents (
  id uuid primary key default gen_random_uuid(),
  agent_type_id uuid not null references public.agent_types(id) on delete restrict,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

alter table public.default_agents enable row level security;

create policy "platform admin full access default_agents" on public.default_agents
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 3) Make `agents` company-scoped (migration-safe sequence)
-- (a) Add company_id column if it doesn't exist
alter table public.agents add column if not exists company_id uuid references public.companies(id);

-- (b) Set company_id to not null after ensuring all records have it
-- First, update any null company_ids with a default company (if needed)
-- This assumes there's at least one company in the system
update public.agents 
set company_id = (select id from public.companies limit 1)
where company_id is null;

alter table public.agents alter column company_id set not null;

-- (d) Add indexes for performance
create index if not exists idx_agents_company_id on public.agents(company_id);
create index if not exists idx_agents_company_status on public.agents(company_id, status);

-- (e) Enable RLS and policies
alter table public.agents enable row level security;

-- Drop any existing policies first
drop policy if exists "platform admin full access agents" on public.agents;
drop policy if exists "company members read agents" on public.agents;
drop policy if exists "company admins insert agents" on public.agents;
drop policy if exists "company admins update agents" on public.agents;
drop policy if exists "company admins delete agents" on public.agents;

-- Platform admin full access
create policy "platform admin full access agents" on public.agents
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Company members can read their company's agents
create policy "company members read agents" on public.agents
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = public.agents.company_id
    )
  );

-- Simple RLS policy: users can only select agents from their own company
create policy "select own company agents only" on public.agents
  for select using (
    company_id = (
      select company_id 
      from public.profiles 
      where id = auth.uid()
    )
  );

-- Company admins can insert/update/delete their company's agents
create policy "company admins insert agents" on public.agents
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

create policy "company admins update agents" on public.agents
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

create policy "company admins delete agents" on public.agents
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

-- 4) Seed defaults for new companies (trigger)
create or replace function public.seed_default_agents_for_company()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    NEW.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    NEW.created_by
  from public.default_agents da
  join public.agent_types at on at.id = da.agent_type_id
  where not exists (
    select 1 from public.agents a
    where a.company_id = NEW.id and a.agent_type_id = da.agent_type_id
  );
  return NEW;
end;$$;

drop trigger if exists trg_seed_default_agents on public.companies;
create trigger trg_seed_default_agents
after insert on public.companies
for each row execute function public.seed_default_agents_for_company();

-- 5) Create default agents from agent types (if default_agents table is empty)
insert into public.default_agents (agent_type_id, name, description, config, status, created_by)
select 
  at.id,
  at.name,
  at.description,
  jsonb_build_object(
    'instructions', 'You are a ' || at.name || ' assistant. ' || coalesce(at.description, ''),
    'ai_provider', 'openai',
    'ai_model', 'gpt-4o',
    'max_tokens', 2000,
    'web_access', false
  ),
  'active',
  (select id from auth.users limit 1)
from public.agent_types at
where not exists (select 1 from public.default_agents limit 1);

-- 6) Backfill all existing companies now
insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
select 
  c.id, 
  da.agent_type_id, 
  da.name, 
  at.name as role,
  da.description, 
  da.config as configuration, 
  coalesce(da.status::agent_status, 'active'::agent_status), 
  da.created_by
from public.companies c
cross join public.default_agents da
join public.agent_types at on at.id = da.agent_type_id
where not exists (
  select 1 from public.agents a
  where a.company_id = c.id and a.agent_type_id = da.agent_type_id
);

-- 7) RPCs for copying defaults into companies
create or replace function public.copy_default_agent_to_company(
  p_default_agent_id uuid,
  p_company_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role text; v_company uuid; v_type uuid;
begin
  if not public.is_platform_admin() then
    select role, company_id into v_role, v_company from public.profiles where id = auth.uid();
    if v_role <> 'admin' or v_company <> p_company_id then
      raise exception 'not authorized';
    end if;
  end if;

  select agent_type_id into v_type from public.default_agents where id = p_default_agent_id;

  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    p_company_id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    auth.uid()
  from public.default_agents da
  join public.agent_types at on at.id = da.agent_type_id
  where da.id = p_default_agent_id
    and not exists (
      select 1 from public.agents a 
      where a.company_id = p_company_id and a.agent_type_id = da.agent_type_id
    )
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.agents a 
    where a.company_id = p_company_id and a.agent_type_id = v_type limit 1;
  end if;
  return v_id;
end;$$;

create or replace function public.seed_default_agent_to_all_companies(
  p_default_agent_id uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; 
begin
  if not public.is_platform_admin() then raise exception 'not authorized'; end if;
  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    c.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    auth.uid()
  from public.companies c
  join public.default_agents da on da.id = p_default_agent_id
  join public.agent_types at on at.id = da.agent_type_id
  where not exists (
    select 1 from public.agents a 
    where a.company_id = c.id and a.agent_type_id = da.agent_type_id
  );
  get diagnostics v_count = row_count;
  return v_count;
end;$$;

-- 8) RLS for metrics (restrict by company via agent)
alter table public.agent_metrics enable row level security;

-- Drop existing policies if they exist
drop policy if exists "platform admin metrics" on public.agent_metrics;
drop policy if exists "company members read metrics" on public.agent_metrics;

create policy "platform admin metrics" on public.agent_metrics
  for select using (public.is_platform_admin());

create policy "company members read metrics" on public.agent_metrics
  for select using (
    exists (
      select 1 from public.agents a
      join public.profiles p on p.id = auth.uid() and p.company_id = a.company_id
      where a.id = public.agent_metrics.agent_id
    )
  );

-- 9) Add platform admin to the platform_admins table (you'll need to manually add your user ID)
-- Example: INSERT INTO public.platform_admins (user_id) VALUES ('your-user-uuid-here');


-- ============================================================================
-- Migration: 20250121000000_fix_channel_delete_notification.sql
-- ============================================================================

-- Fix notification trigger to handle channel deletion gracefully
-- When a channel is deleted, members don't need to be notified they were "removed"
-- Also add missing DELETE policy for channels table

-- 1. Add DELETE policy for channels
DROP POLICY IF EXISTS "Users can delete channels they created or are admin of" ON channels;
CREATE POLICY "Users can delete channels they created or are admin of" 
ON channels 
FOR DELETE 
USING (
  auth.role() = 'authenticated' AND
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) AND
  (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role = 'admin'
    )
  )
);

-- 2. Fix the notify_member_removed function to handle channel deletions
CREATE OR REPLACE FUNCTION public.notify_member_removed()
RETURNS TRIGGER AS $$
DECLARE
  channel_name text;
  removed_user_name text;
BEGIN
  -- Try to get channel name
  SELECT name INTO channel_name
  FROM channels
  WHERE id = OLD.channel_id;

  -- If channel doesn't exist, it's being deleted, so skip notification
  IF channel_name IS NULL THEN
    RETURN OLD;
  END IF;

  -- Get removed user name
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO removed_user_name
  FROM profiles
  WHERE id = OLD.user_id;

  removed_user_name := COALESCE(removed_user_name, 'A member');

  -- Notify the removed user
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    channel_id
  ) VALUES (
    OLD.user_id,
    'member_removed',
    'Removed from #' || channel_name,
    'You were removed from #' || channel_name,
    jsonb_build_object(
      'channel_name', channel_name,
      'member_name', removed_user_name,
      'jump_url', '/channels'
    ),
    OLD.channel_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_member_removed IS 'Creates notifications when users are removed from channels (skips if channel is being deleted)';



-- ============================================================================
-- Migration: 20250125000000_add_consultation_communication.sql
-- ============================================================================

-- Add consultation messages table for admin-user communication
CREATE TABLE public.consultation_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'user')),
    sender_id UUID NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_document_request BOOLEAN DEFAULT false,
    is_note BOOLEAN DEFAULT false,
    is_private_note BOOLEAN DEFAULT false,
    documents_requested TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add consultation documents table
CREATE TABLE public.consultation_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add status column to consultation_requests if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consultation_requests' AND column_name='status') THEN
        ALTER TABLE public.consultation_requests ADD COLUMN status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'in_progress', 'completed', 'on_hold'));
    END IF;
END $$;

-- Add consultation progress tracking
CREATE TABLE public.consultation_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    current_step INTEGER DEFAULT 1,
    step_name TEXT NOT NULL,
    step_description TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(consultation_request_id, current_step)
);

-- Create indexes for performance
CREATE INDEX idx_consultation_messages_consultation_id ON public.consultation_messages(consultation_request_id);
CREATE INDEX idx_consultation_messages_created_at ON public.consultation_messages(created_at);
CREATE INDEX idx_consultation_documents_consultation_id ON public.consultation_documents(consultation_request_id);
CREATE INDEX idx_consultation_progress_consultation_id ON public.consultation_progress(consultation_request_id);

-- Add foreign key constraints
ALTER TABLE public.consultation_messages 
ADD CONSTRAINT fk_consultation_messages_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

ALTER TABLE public.consultation_documents 
ADD CONSTRAINT fk_consultation_documents_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

ALTER TABLE public.consultation_progress 
ADD CONSTRAINT fk_consultation_progress_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

-- Add RLS policies for consultation messages
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Users can read all messages for their consultation requests (excluding private admin notes)
CREATE POLICY "Users can read their consultation messages" 
ON public.consultation_messages FOR SELECT 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    ) 
    AND (is_private_note = false OR sender_type = 'user')
);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages" 
ON public.consultation_messages FOR INSERT 
WITH CHECK (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
    AND sender_type = 'user'
);

-- Admins can read and insert all consultation messages
CREATE POLICY "Admins can manage all consultation messages" 
ON public.consultation_messages FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Add RLS policies for consultation documents
ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;

-- Users can read and insert documents for their consultation requests
CREATE POLICY "Users can manage their consultation documents" 
ON public.consultation_documents FOR ALL 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
);

-- Admins can read and manage all consultation documents
CREATE POLICY "Admins can manage all consultation documents" 
ON public.consultation_documents FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Add RLS policies for consultation progress
ALTER TABLE public.consultation_progress ENABLE ROW LEVEL SECURITY;

-- Users can read progress for their consultation requests
CREATE POLICY "Users can read their consultation progress" 
ON public.consultation_progress FOR SELECT 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
);

-- Admins can manage all consultation progress
CREATE POLICY "Admins can manage all consultation progress" 
ON public.consultation_progress FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Create storage bucket for consultation documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('consultation-documents', 'consultation-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Add storage policies for consultation documents bucket
CREATE POLICY "Users can upload consultation documents" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'consultation-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can read consultation documents" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'consultation-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can manage all consultation documents" 
ON storage.objects FOR ALL 
USING (
    bucket_id = 'consultation-documents' 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);



-- ============================================================================
-- Migration: 20250125000001_add_agent_id_to_chat_messages.sql
-- ============================================================================

-- Add agent_id column to chat_messages table to support agent mentions in channels
ALTER TABLE public.chat_messages 
ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

-- Add index for performance when querying messages by agent
CREATE INDEX idx_chat_messages_agent_id ON public.chat_messages(agent_id);

-- Add comment to document the purpose of the column
COMMENT ON COLUMN public.chat_messages.agent_id IS 'References the agent being called/mentioned in channel messages';





-- ============================================================================
-- Migration: 20250125000001_add_agent_message_notifications.sql
-- ============================================================================

-- Add agent message notification system
-- This migration creates a trigger to notify users when agents send messages
-- and they are not currently in the chat/channel

-- First, ensure the notifications table exists (if not already created)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification_reads table if not exists
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Create user_presence table to track if users are currently in chat/channel
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure only one active presence per user per channel/conversation
  UNIQUE(user_id, channel_id, conversation_id)
);

-- Enable RLS on new tables (only if not already enabled)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'notifications' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'notification_reads' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications" 
        ON public.notifications FOR SELECT 
        USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications" 
        ON public.notifications FOR UPDATE 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- RLS policies for notification_reads (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notification_reads' 
        AND policyname = 'Users can manage their own notification reads'
    ) THEN
        CREATE POLICY "Users can manage their own notification reads" 
        ON public.notification_reads FOR ALL 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- RLS policies for user_presence (only create if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_presence' 
        AND policyname = 'Users can manage their own presence'
    ) THEN
        CREATE POLICY "Users can manage their own presence" 
        ON public.user_presence FOR ALL 
        USING (user_id = auth.uid());
    END IF;
END $$;

-- Function to create agent message notifications
CREATE OR REPLACE FUNCTION public.create_agent_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  agent_name text;
  channel_name text;
  conversation_user_id uuid;
  is_user_present boolean;
  notification_data jsonb;
  jump_url text;
BEGIN
  -- Only process assistant messages (agent messages)
  IF NEW.role != 'assistant' THEN
    RETURN NEW;
  END IF;

  -- Get agent name
  SELECT name INTO agent_name 
  FROM agents 
  WHERE id = NEW.agent_id;

  -- Handle channel messages
  IF NEW.channel_id IS NOT NULL THEN
    -- Get channel name
    SELECT name INTO channel_name 
    FROM channels 
    WHERE id = NEW.channel_id;

    -- Get all channel members who should be notified
    FOR target_user_id IN 
      SELECT cm.user_id 
      FROM channel_members cm
      WHERE cm.channel_id = NEW.channel_id
    LOOP
      -- Check if user is currently present in the channel
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = target_user_id 
        AND up.channel_id = NEW.channel_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'channel_name', COALESCE(channel_name, 'Channel'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          channel_id,
          message_id,
          agent_id
        ) VALUES (
          target_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded in #' || COALESCE(channel_name, 'channel'),
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.channel_id,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END LOOP;

  -- Handle direct conversation messages
  ELSIF NEW.conversation_id IS NOT NULL THEN
    -- Get the user who owns this conversation
    SELECT user_id INTO conversation_user_id
    FROM chat_conversations
    WHERE id = NEW.conversation_id;

    IF conversation_user_id IS NOT NULL THEN
      -- Check if user is currently present in the conversation
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = conversation_user_id 
        AND up.conversation_id = NEW.conversation_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          message_id,
          agent_id
        ) VALUES (
          conversation_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded',
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for agent message notifications
DROP TRIGGER IF EXISTS trigger_agent_message_notification ON chat_messages;
CREATE TRIGGER trigger_agent_message_notification
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_agent_message_notification();

-- Function to update user presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_user_id uuid,
  p_channel_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert user presence
  INSERT INTO user_presence (user_id, channel_id, conversation_id, is_active, last_seen)
  VALUES (p_user_id, p_channel_id, p_conversation_id, true, now())
  ON CONFLICT (user_id, channel_id, conversation_id)
  DO UPDATE SET 
    is_active = true,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- Function to mark user as away
CREATE OR REPLACE FUNCTION public.mark_user_away(
  p_user_id uuid,
  p_channel_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark user as away
  UPDATE user_presence 
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id 
  AND (channel_id = p_channel_id OR (channel_id IS NULL AND p_channel_id IS NULL))
  AND (conversation_id = p_conversation_id OR (conversation_id IS NULL AND p_conversation_id IS NULL));
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications(agent_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON notification_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_channel_id ON user_presence(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_conversation_id ON user_presence(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_active ON user_presence(is_active, last_seen);

-- Create trigger for updated_at on user_presence (only if it doesn't exist)
DROP TRIGGER IF EXISTS update_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- Migration: 20250125000001_create_documents_table.sql
-- ============================================================================

-- Create Documents table for storing document content and embeddings
CREATE TABLE public.documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-ada-002 produces 1536-dimensional vectors
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    document_archive_id UUID REFERENCES public.document_archives(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_documents_company_id ON public.documents(company_id);
CREATE INDEX idx_documents_agent_id ON public.documents(agent_id);
CREATE INDEX idx_documents_document_archive_id ON public.documents(document_archive_id);
CREATE INDEX idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops);

-- RLS Policies
-- Users can view documents from their company
CREATE POLICY "Users can view documents from their company" 
ON public.documents FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can insert documents for their company
CREATE POLICY "Users can insert documents for their company" 
ON public.documents FOR INSERT 
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can update documents from their company
CREATE POLICY "Users can update documents from their company" 
ON public.documents FOR UPDATE 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can delete documents from their company
CREATE POLICY "Users can delete documents from their company" 
ON public.documents FOR DELETE 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.documents IS 'Stores document content and OpenAI embeddings for AI agent access';
COMMENT ON COLUMN public.documents.embedding IS 'OpenAI text-embedding-ada-002 vector (1536 dimensions)';
COMMENT ON COLUMN public.documents.agent_id IS 'If NULL, document is accessible by all agents in the company';






-- ============================================================================
-- Migration: 20250127000000_add_raw_scraped_text_to_company_os.sql
-- ============================================================================

-- Add raw_scraped_text column to company_os table for document uploads
ALTER TABLE public.company_os 
ADD COLUMN IF NOT EXISTS raw_scraped_text TEXT;

-- Add comment for the new column
COMMENT ON COLUMN public.company_os.raw_scraped_text IS 'Raw text extracted from uploaded documents for CompanyOS generation';







-- ============================================================================
-- Migration: 20250127000000_consultation_doc_request_trigger.sql
-- ============================================================================

-- Create function to notify about document requests
CREATE OR REPLACE FUNCTION notify_document_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for document requests
  IF NEW.is_document_request = true THEN
    -- Insert into a notification queue table that the Edge Function will process
    INSERT INTO consultation_notifications (
      message_id,
      consultation_request_id,
      created_at
    ) VALUES (
      NEW.id,
      NEW.consultation_request_id,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create notification queue table
CREATE TABLE IF NOT EXISTS consultation_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES consultation_messages(id) ON DELETE CASCADE,
  consultation_request_id UUID NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on consultation_notifications
ALTER TABLE consultation_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for consultation_notifications (only service role can access)
CREATE POLICY "Service role can manage consultation notifications" 
ON consultation_notifications 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create trigger on consultation_messages
DROP TRIGGER IF EXISTS consultation_document_request_trigger ON consultation_messages;
CREATE TRIGGER consultation_document_request_trigger
  AFTER INSERT ON consultation_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_request();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_consultation_notifications_processed 
ON consultation_notifications(processed, created_at);


-- ============================================================================
-- Migration: 20250127000001_platform_admin_playbook_policies.sql
-- ============================================================================

-- Add platform admin policies for playbook sections and related tables
-- This allows platform-admins to view all companies' playbook sections

-- Platform admin can view all playbook sections
CREATE POLICY "Platform admins can view all playbook sections" 
ON public.playbook_sections
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');

-- Platform admin can view all companies (needed for joins in usePlaybookSections)
CREATE POLICY "Platform admins can view all companies" 
ON public.companies
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');

-- Platform admin can view all profiles (needed for joins in usePlaybookSections)
CREATE POLICY "Platform admins can view all profiles" 
ON public.profiles
FOR SELECT 
USING (public.get_user_role() = 'platform-admin');


-- ============================================================================
-- Migration: 20250127000002_add_client_message_id_to_chat_messages.sql
-- ============================================================================

-- Add client_message_id column to chat_messages table for deduplication
-- This allows the frontend to track optimistic messages and reconcile them with server responses

ALTER TABLE chat_messages 
ADD COLUMN client_message_id TEXT;

-- Add index for efficient lookups by client_message_id
CREATE INDEX idx_chat_messages_client_message_id ON chat_messages(client_message_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN chat_messages.client_message_id IS 'Client-generated ID for optimistic UI updates and deduplication';


-- ============================================================================
-- Migration: 20250127000003_unique_chat_conversation.sql
-- ============================================================================

-- Create unique index to prevent duplicate conversations between user, agent, and company
-- This ensures only one conversation can exist per user-agent-company combination

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_agent_company_conversation 
ON public.chat_conversations (user_id, agent_id, company_id);

-- Add comment for documentation
COMMENT ON INDEX unique_user_agent_company_conversation IS 'Ensures only one conversation exists per user-agent-company combination to prevent duplicate conversations when switching agents';


-- ============================================================================
-- Migration: 20250127000004_private_channel_visibility.sql
-- ============================================================================

-- Update RLS policy for channels to respect privacy settings
-- Only show private channels to their members, public channels to all company users

-- Drop the existing policies
DROP POLICY IF EXISTS "Users can view channels in their company" ON channels;
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;

-- Create new policy that handles private channels properly
-- Use a simpler approach: show public channels to all company users,
-- and private channels only to users who are members
CREATE POLICY "Users can view public channels and private channels they are members of" 
ON channels 
FOR SELECT 
USING (
  company_id = get_user_company_id() AND (
    is_private = false OR 
    (is_private = true AND auth.uid() IN (
      SELECT user_id FROM channel_members 
      WHERE channel_id = channels.id
    ))
  )
);

-- Also update the policy for chat_messages to ensure private channel messages are protected
DROP POLICY IF EXISTS "Users can manage messages in their conversations and channels" ON chat_messages;

CREATE POLICY "Users can manage messages in their conversations and channels" 
ON chat_messages 
FOR ALL 
USING (
  (conversation_id IS NOT NULL AND conversation_id IN (
    SELECT chat_conversations.id
    FROM chat_conversations
    WHERE chat_conversations.company_id = get_user_company_id()
  )) OR
  (channel_id IS NOT NULL AND channel_id IN (
    SELECT channels.id
    FROM channels
    WHERE channels.company_id = get_user_company_id() AND (
      channels.is_private = false OR 
      (channels.is_private = true AND EXISTS (
        SELECT 1 FROM channel_members 
        WHERE channel_members.channel_id = channels.id 
        AND channel_members.user_id = auth.uid()
      ))
    )
  ))
);


-- ============================================================================
-- Migration: 20250127000005_fix_channel_members_rls.sql
-- ============================================================================

-- Fix channel_members RLS policy to work with private channels
-- Users should be able to see their own memberships and members of channels they have access to

-- Drop existing channel_members policies
DROP POLICY IF EXISTS "Users can view channel members for their company channels" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- Create new policies that allow users to see their own memberships and public channel memberships
CREATE POLICY "Users can view their own channel memberships and public channel members" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR -- Users can always see their own memberships
  EXISTS (
    SELECT 1 FROM channels c 
    WHERE c.id = channel_members.channel_id 
    AND c.company_id = get_user_company_id()
    AND c.is_private = false -- Public channels - anyone in company can see members
  ) OR
  -- Allow users to see memberships for channels they are members of (for private channels)
  auth.uid() IN (
    SELECT user_id FROM channel_members cm2 
    WHERE cm2.channel_id = channel_members.channel_id
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM channels c 
    WHERE c.id = channel_members.channel_id 
    AND c.company_id = get_user_company_id()
  )
);


-- ============================================================================
-- Migration: 20250127000006_fix_channel_visibility_final.sql
-- ============================================================================

-- Final fix for channel visibility issues
-- The problem might be with the complex RLS policy logic

-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;
DROP POLICY IF EXISTS "Users can view their own channel memberships and public channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- Create a simpler, more reliable channel visibility policy
CREATE POLICY "Users can view channels in their company with privacy respect" 
ON channels 
FOR SELECT 
USING (
  company_id = get_user_company_id() AND (
    is_private = false OR 
    id IN (
      SELECT channel_id 
      FROM channel_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Create a simpler channel_members policy
CREATE POLICY "Users can view channel memberships" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id() AND is_private = false
  ) OR
  auth.uid() IN (
    SELECT user_id FROM channel_members cm2 
    WHERE cm2.channel_id = channel_members.channel_id
  )
);

-- Allow channel management operations
CREATE POLICY "Users can manage channel members" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);


-- ============================================================================
-- Migration: 20250127000007_fix_channel_rls_errors.sql
-- ============================================================================

-- Fix RLS policies that are causing 500 errors
-- The issue is likely with complex subqueries in RLS policies

-- Drop all existing channel and channel_members policies
DROP POLICY IF EXISTS "Users can view channels in their company with privacy respect" ON channels;
DROP POLICY IF EXISTS "Users can view their own channel memberships and public channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;

-- Create simple, reliable policies

-- Channels: Allow users to see channels in their company, with privacy handled at application level
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (company_id = get_user_company_id());

-- Channel members: Allow users to see their own memberships and manage memberships for their company channels
CREATE POLICY "Users can view channel memberships" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);


-- ============================================================================
-- Migration: 20250128000001_fix_web_research_tools.sql
-- ============================================================================

-- Fix Web Research Tools Configuration
-- Ensures all agents have access to the openai_web_research tool for Perplexity integration

-- First, ensure the openai_web_research tool exists with correct schema
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'openai_web_research',
  'OpenAI Web Research',
  'openai',
  'Perform web research using Perplexity API with current information and source citations',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The research query or topic to investigate"
      },
      "focus_areas": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific areas or aspects to focus the research on"
      },
      "depth": {
        "type": "string",
        "enum": ["quick", "detailed", "comprehensive"],
        "default": "detailed",
        "description": "The depth of research to perform"
      },
      "include_sources": {
        "type": "boolean",
        "default": true,
        "description": "Whether to include source citations in the results"
      }
    },
    "required": ["query"]
  }'::jsonb
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schema_definition = EXCLUDED.schema_definition;

-- Get the tool ID for the web research tool
DO $$
DECLARE
    web_research_tool_id UUID;
BEGIN
    -- Get the tool ID
    SELECT id INTO web_research_tool_id 
    FROM public.tools 
    WHERE name = 'openai_web_research';
    
    IF web_research_tool_id IS NOT NULL THEN
        -- Add web research tool to all existing agents that don't have it
        INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
        SELECT 
            a.id as agent_id,
            web_research_tool_id as tool_id,
            true as is_enabled,
            '{}'::jsonb as configuration
        FROM public.agents a
        WHERE NOT EXISTS (
            SELECT 1 FROM public.agent_tools at 
            WHERE at.agent_id = a.id AND at.tool_id = web_research_tool_id
        );
        
        RAISE NOTICE 'Added web research tool to agents missing it';
        
        -- Enable the tool for agents that have it disabled
        UPDATE public.agent_tools 
        SET is_enabled = true
        WHERE tool_id = web_research_tool_id AND is_enabled = false;
        
        RAISE NOTICE 'Enabled web research tool for previously disabled agents';
    ELSE
        RAISE NOTICE 'Web research tool not found - skipping agent updates';
    END IF;
END $$;

-- Update the trigger function to include web research tool for new agents
CREATE OR REPLACE FUNCTION add_openai_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all OpenAI tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'openai';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_add_openai_tools_to_new_agent ON public.agents;
CREATE TRIGGER trigger_add_openai_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_openai_tools_to_new_agent();

-- Create index for better performance on agent_tools queries
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id_enabled 
ON public.agent_tools (tool_id, is_enabled) 
WHERE is_enabled = true;

-- Create index for agent_tools lookups by agent
CREATE INDEX IF NOT EXISTS idx_agent_tools_agent_id_enabled 
ON public.agent_tools (agent_id, is_enabled) 
WHERE is_enabled = true;

-- Add comment explaining the web research integration
COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. Web research tool (openai_web_research) uses Perplexity API for current information.';

-- Add helpful view for monitoring web research tool availability
CREATE OR REPLACE VIEW agent_web_research_status AS
SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.status as agent_status,
    c.name as company_name,
    CASE 
        WHEN at.id IS NOT NULL AND at.is_enabled = true THEN 'Enabled'
        WHEN at.id IS NOT NULL AND at.is_enabled = false THEN 'Disabled'
        ELSE 'Not Available'
    END as web_research_status,
    at.configuration as tool_configuration
FROM public.agents a
LEFT JOIN public.companies c ON a.company_id = c.id
LEFT JOIN public.tools t ON t.name = 'openai_web_research'
LEFT JOIN public.agent_tools at ON at.agent_id = a.id AND at.tool_id = t.id;

-- Grant access to the view
GRANT SELECT ON agent_web_research_status TO authenticated;
GRANT SELECT ON agent_web_research_status TO service_role;


-- ============================================================================
-- Migration: 20250128000002_add_quickbooks_tools.sql
-- ============================================================================

-- Add QuickBooks tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'quickbooks_customers_search',
  'QuickBooks Customer Search',
  'quickbooks',
  'Search QuickBooks customers for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for customers (e.g., ''John Smith'', ''Acme Corp'', ''john@example.com'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of customers to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_customers_create',
  'QuickBooks Customer Creation',
  'quickbooks',
  'Create a new QuickBooks customer',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Customer name (required)"
      },
      "email": {
        "type": "string",
        "description": "Customer email address"
      },
      "phone": {
        "type": "string",
        "description": "Customer phone number"
      },
      "company_name": {
        "type": "string",
        "description": "Customer company name"
      },
      "billing_address": {
        "type": "object",
        "description": "Billing address object with line1, city, country, postal_code"
      }
    },
    "required": ["name"]
  }'::jsonb
),
(
  'quickbooks_invoices_search',
  'QuickBooks Invoice Search',
  'quickbooks',
  'Search QuickBooks invoices for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for invoices (e.g., ''INV-001'', ''unpaid'', ''overdue'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of invoices to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_invoices_create',
  'QuickBooks Invoice Creation',
  'quickbooks',
  'Create a new QuickBooks invoice',
  '{
    "type": "object",
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "QuickBooks customer ID (required)"
      },
      "line_items": {
        "type": "array",
        "description": "Array of line items with amount, description, and item_id"
      },
      "due_date": {
        "type": "string",
        "description": "Invoice due date (ISO 8601 format)"
      },
      "invoice_date": {
        "type": "string",
        "description": "Invoice date (ISO 8601 format)"
      }
    },
    "required": ["customer_id", "line_items"]
  }'::jsonb
),
(
  'quickbooks_payments_search',
  'QuickBooks Payment Search',
  'quickbooks',
  'Search QuickBooks payments for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for payments (e.g., ''PAY-001'', ''credit card'', ''bank transfer'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of payments to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_payments_create',
  'QuickBooks Payment Creation',
  'quickbooks',
  'Create a new QuickBooks payment',
  '{
    "type": "object",
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "QuickBooks customer ID (required)"
      },
      "amount": {
        "type": "number",
        "description": "Payment amount (required)"
      },
      "payment_method": {
        "type": "string",
        "description": "Payment method (e.g., ''Cash'', ''Check'', ''Credit Card'')"
      },
      "payment_date": {
        "type": "string",
        "description": "Payment date (ISO 8601 format)"
      },
      "invoice_id": {
        "type": "string",
        "description": "Associated invoice ID"
      }
    },
    "required": ["customer_id", "amount"]
  }'::jsonb
),
(
  'quickbooks_items_search',
  'QuickBooks Item Search',
  'quickbooks',
  'Search QuickBooks items for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for items (e.g., ''Product A'', ''Service B'', ''SKU-123'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of items to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_items_create',
  'QuickBooks Item Creation',
  'quickbooks',
  'Create a new QuickBooks item',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Item name (required)"
      },
      "type": {
        "type": "string",
        "description": "Item type (e.g., ''Service'', ''Inventory'', ''NonInventory'')",
        "enum": ["Service", "Inventory", "NonInventory"]
      },
      "unit_price": {
        "type": "number",
        "description": "Unit price for the item"
      },
      "description": {
        "type": "string",
        "description": "Item description"
      },
      "sku": {
        "type": "string",
        "description": "Item SKU"
      }
    },
    "required": ["name", "type"]
  }'::jsonb
),
(
  'quickbooks_accounts_search',
  'QuickBooks Account Search',
  'quickbooks',
  'Search QuickBooks accounts for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for accounts (e.g., ''Cash'', ''Accounts Receivable'', ''Sales'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of accounts to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
);

-- Add QuickBooks tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'quickbooks'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add QuickBooks tools to new agents
CREATE OR REPLACE FUNCTION add_quickbooks_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all QuickBooks tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'quickbooks';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add QuickBooks tools to new agents
CREATE TRIGGER trigger_add_quickbooks_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_quickbooks_tools_to_new_agent();

-- Create index for better performance on enabled tool queries
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id_enabled 
ON public.agent_tools (tool_id, is_enabled) 
WHERE is_enabled = true;

COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. QuickBooks tools provide financial management capabilities including customer, invoice, payment, and item management.';


-- ============================================================================
-- Migration: 20250128000003_add_hubspot_tools.sql
-- ============================================================================

-- Add HubSpot tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'hubspot_contacts_search',
  'HubSpot Contact Search',
  'hubspot',
  'Search HubSpot contacts for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for contacts (e.g., ''john@example.com'', ''John Smith'', ''Acme Corp'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of contacts to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''email'', ''firstname'', ''lastname'', ''phone'', ''company''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_contacts_create',
  'HubSpot Contact Creation',
  'hubspot',
  'Create a new HubSpot contact',
  '{
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Contact email address (required)"
      },
      "first_name": {
        "type": "string",
        "description": "Contact''s first name"
      },
      "last_name": {
        "type": "string",
        "description": "Contact''s last name"
      },
      "phone": {
        "type": "string",
        "description": "Contact''s phone number"
      },
      "company": {
        "type": "string",
        "description": "Contact''s company name"
      },
      "job_title": {
        "type": "string",
        "description": "Contact''s job title"
      }
    },
    "required": ["email"]
  }'::jsonb
),
(
  'hubspot_contacts_update',
  'HubSpot Contact Update',
  'hubspot',
  'Update an existing HubSpot contact',
  '{
    "type": "object",
    "properties": {
      "contact_id": {
        "type": "string",
        "description": "HubSpot contact ID"
      },
      "properties": {
        "type": "object",
        "description": "Properties to update (e.g., {firstname: ''John'', lastname: ''Doe'', phone: ''+1234567890''})"
      }
    },
    "required": ["contact_id", "properties"]
  }'::jsonb
),
(
  'hubspot_companies_search',
  'HubSpot Company Search',
  'hubspot',
  'Search HubSpot companies for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for companies (e.g., ''Acme Corp'', ''tech startup'', ''manufacturing'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of companies to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''name'', ''domain'', ''industry'', ''city'', ''state''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_companies_create',
  'HubSpot Company Creation',
  'hubspot',
  'Create a new HubSpot company',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Company name (required)"
      },
      "domain": {
        "type": "string",
        "description": "Company domain"
      },
      "industry": {
        "type": "string",
        "description": "Company industry"
      },
      "city": {
        "type": "string",
        "description": "Company city"
      },
      "state": {
        "type": "string",
        "description": "Company state"
      },
      "country": {
        "type": "string",
        "description": "Company country"
      }
    },
    "required": ["name"]
  }'::jsonb
),
(
  'hubspot_deals_search',
  'HubSpot Deal Search',
  'hubspot',
  'Search HubSpot deals for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for deals (e.g., ''Q4 deal'', ''enterprise'', ''renewal'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of deals to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''dealname'', ''dealstage'', ''amount'', ''closedate''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_deals_create',
  'HubSpot Deal Creation',
  'hubspot',
  'Create a new HubSpot deal',
  '{
    "type": "object",
    "properties": {
      "deal_name": {
        "type": "string",
        "description": "Deal name (required)"
      },
      "deal_stage": {
        "type": "string",
        "description": "Deal stage (e.g., ''appointmentscheduled'', ''qualifiedtobuy'', ''presentationscheduled'')"
      },
      "amount": {
        "type": "number",
        "description": "Deal amount"
      },
      "currency": {
        "type": "string",
        "description": "Currency code (e.g., ''USD'', ''EUR'')"
      },
      "close_date": {
        "type": "string",
        "description": "Expected close date (ISO 8601 format)"
      },
      "deal_type": {
        "type": "string",
        "description": "Deal type (e.g., ''newbusiness'', ''existingbusiness'')"
      }
    },
    "required": ["deal_name"]
  }'::jsonb
),
(
  'hubspot_deals_update',
  'HubSpot Deal Update',
  'hubspot',
  'Update an existing HubSpot deal',
  '{
    "type": "object",
    "properties": {
      "deal_id": {
        "type": "string",
        "description": "HubSpot deal ID"
      },
      "properties": {
        "type": "object",
        "description": "Properties to update (e.g., {dealstage: ''closedwon'', amount: ''50000''})"
      }
    },
    "required": ["deal_id", "properties"]
  }'::jsonb
),
(
  'hubspot_tickets_search',
  'HubSpot Ticket Search',
  'hubspot',
  'Search HubSpot tickets for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for tickets (e.g., ''urgent'', ''billing'', ''login issue'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of tickets to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''subject'', ''content'', ''priority'', ''ticket_status''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_tickets_create',
  'HubSpot Ticket Creation',
  'hubspot',
  'Create a new HubSpot ticket',
  '{
    "type": "object",
    "properties": {
      "subject": {
        "type": "string",
        "description": "Ticket subject (required)"
      },
      "content": {
        "type": "string",
        "description": "Ticket content or description"
      },
      "priority": {
        "type": "string",
        "description": "Ticket priority (e.g., ''LOW'', ''MEDIUM'', ''HIGH'')"
      },
      "ticket_status": {
        "type": "string",
        "description": "Ticket status (e.g., ''NEW'', ''OPEN'', ''PENDING'')"
      },
      "category": {
        "type": "string",
        "description": "Ticket category (e.g., ''QUESTION'', ''PROBLEM'', ''REQUEST'')"
      }
    },
    "required": ["subject"]
  }'::jsonb
);

-- Add HubSpot tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'hubspot'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add HubSpot tools to new agents
CREATE OR REPLACE FUNCTION add_hubspot_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all HubSpot tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'hubspot';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add HubSpot tools to new agents
CREATE TRIGGER trigger_add_hubspot_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_hubspot_tools_to_new_agent();

COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. HubSpot tools provide CRM capabilities including contact, company, deal, and ticket management.';


-- ============================================================================
-- Migration: 20250129000001_fix_agent_notification_urls.sql
-- ============================================================================

-- Fix agent notification URLs to redirect to client dashboard
-- This migration updates the agent message notification trigger to use the correct jump URLs

-- Update the function to use client-dashboard URLs for all agent notifications
CREATE OR REPLACE FUNCTION public.create_agent_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  agent_name text;
  channel_name text;
  conversation_user_id uuid;
  is_user_present boolean;
  notification_data jsonb;
  jump_url text;
BEGIN
  -- Only process assistant messages (agent messages)
  IF NEW.role != 'assistant' THEN
    RETURN NEW;
  END IF;

  -- Get agent name
  SELECT name INTO agent_name 
  FROM agents 
  WHERE id = NEW.agent_id;

  -- Handle channel messages
  IF NEW.channel_id IS NOT NULL THEN
    -- Get channel name
    SELECT name INTO channel_name 
    FROM channels 
    WHERE id = NEW.channel_id;

    -- Get all channel members who should be notified
    FOR target_user_id IN 
      SELECT cm.user_id 
      FROM channel_members cm
      WHERE cm.channel_id = NEW.channel_id
    LOOP
      -- Check if user is currently present in the channel
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = target_user_id 
        AND up.channel_id = NEW.channel_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'channel_name', COALESCE(channel_name, 'Channel'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          channel_id,
          message_id,
          agent_id
        ) VALUES (
          target_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded in #' || COALESCE(channel_name, 'channel'),
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.channel_id,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END LOOP;

  -- Handle direct conversation messages
  ELSIF NEW.conversation_id IS NOT NULL THEN
    -- Get the user who owns this conversation
    SELECT user_id INTO conversation_user_id
    FROM chat_conversations
    WHERE id = NEW.conversation_id;

    IF conversation_user_id IS NOT NULL THEN
      -- Check if user is currently present in the conversation
      SELECT EXISTS(
        SELECT 1 FROM user_presence up
        WHERE up.user_id = conversation_user_id 
        AND up.conversation_id = NEW.conversation_id 
        AND up.is_active = true
        AND up.last_seen > now() - interval '5 minutes'
      ) INTO is_user_present;

      -- Only create notification if user is not present
      IF NOT is_user_present THEN
        -- Prepare notification data
        notification_data := jsonb_build_object(
          'agent_name', COALESCE(agent_name, 'AI Agent'),
          'message_preview', LEFT(NEW.content, 100),
          'jump_url', '/client-dashboard?agent=' || NEW.agent_id
        );

        -- Create notification
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          message_id,
          agent_id
        ) VALUES (
          conversation_user_id,
          'agent_response',
          COALESCE(agent_name, 'AI Agent') || ' responded',
          '"' || LEFT(NEW.content, 100) || '"',
          notification_data,
          NEW.id,
          NEW.agent_id
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- Migration: 20250130000000_hubspot_integration.sql
-- ============================================================================

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





-- ============================================================================
-- Migration: 20250130000000_merge_duplicate_conversations.sql
-- ============================================================================

-- Merge duplicate conversations to ensure single conversation per user-agent-company
-- This migration safely consolidates any existing duplicates before enforcing uniqueness

BEGIN;

-- Create a temporary table to identify duplicate groups and choose which to keep
CREATE TEMP TABLE conversation_duplicates AS
WITH duplicate_groups AS (
  SELECT 
    user_id,
    agent_id, 
    company_id,
    array_agg(id ORDER BY created_at ASC, id ASC) as conversation_ids,
    min(id) as keep_id
  FROM chat_conversations
  GROUP BY user_id, agent_id, company_id
  HAVING count(*) > 1
)
SELECT 
  user_id,
  agent_id,
  company_id,
  keep_id,
  array_remove(conversation_ids, keep_id) as remove_ids
FROM duplicate_groups;

-- Log how many duplicates we found
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT count(*) INTO duplicate_count FROM conversation_duplicates;
  RAISE NOTICE 'Found % duplicate conversation groups to merge', duplicate_count;
END $$;

-- Reassign messages from duplicate conversations to the kept conversation
UPDATE chat_messages 
SET conversation_id = cd.keep_id
FROM conversation_duplicates cd
WHERE chat_messages.conversation_id = ANY(cd.remove_ids);

-- Log how many messages were reassigned
DO $$
DECLARE
  reassigned_count INTEGER;
BEGIN
  SELECT count(*) INTO reassigned_count 
  FROM chat_messages cm
  JOIN conversation_duplicates cd ON cm.conversation_id = ANY(cd.remove_ids);
  RAISE NOTICE 'Reassigned % messages to kept conversations', reassigned_count;
END $$;

-- Delete the duplicate conversations
DELETE FROM chat_conversations 
WHERE id IN (
  SELECT unnest(remove_ids) 
  FROM conversation_duplicates
);

-- Log how many conversations were deleted
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT count(*) INTO deleted_count 
  FROM conversation_duplicates cd
  JOIN unnest(cd.remove_ids) AS id ON true;
  RAISE NOTICE 'Deleted % duplicate conversations', deleted_count;
END $$;

-- Ensure the unique index exists (should already be there from previous migration)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_agent_company_conversation 
ON public.chat_conversations (user_id, agent_id, company_id);

-- Verify no duplicates remain
DO $$
DECLARE
  remaining_duplicates INTEGER;
BEGIN
  SELECT count(*) INTO remaining_duplicates
  FROM (
    SELECT user_id, agent_id, company_id
    FROM chat_conversations
    GROUP BY user_id, agent_id, company_id
    HAVING count(*) > 1
  ) duplicates;
  
  IF remaining_duplicates > 0 THEN
    RAISE EXCEPTION 'Migration failed: % duplicate groups still exist', remaining_duplicates;
  ELSE
    RAISE NOTICE 'Migration successful: No duplicate conversations remain';
  END IF;
END $$;

COMMIT;


-- ============================================================================
-- Migration: 20250130000001_fix_channel_members_visibility.sql
-- ============================================================================

-- Fix channel_members RLS policy to allow proper visibility of team members
-- Users should be able to see all members of channels they have access to

-- Drop existing channel_members policies
DROP POLICY IF EXISTS "Users can view channel memberships" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;

-- Create new policies that allow proper visibility
CREATE POLICY "Users can view channel members for accessible channels" 
ON channel_members 
FOR SELECT 
USING (
  -- Users can see their own memberships
  user_id = auth.uid() OR
  -- Users can see all members of channels in their company
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);


-- ============================================================================
-- Migration: 20250130000002_test_user_company_function.sql
-- ============================================================================

-- Test and fix get_user_company_id function if needed
-- This migration ensures the function is working correctly

-- Drop and recreate the function to ensure it's working
DROP FUNCTION IF EXISTS public.get_user_company_id();

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Return the company_id for the current authenticated user
  RETURN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;


-- ============================================================================
-- Migration: 20250130000003_comprehensive_channel_fix.sql
-- ============================================================================

-- Comprehensive fix for channel members visibility issues
-- This migration addresses potential RLS policy issues and ensures proper data access

-- 1. First, let's ensure the get_user_company_id function is working correctly
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Return the company_id for the current authenticated user
  -- Add error handling to prevent issues
  RETURN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return null if there's any error
    RETURN NULL;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- 2. Drop all existing channel-related policies to start fresh
DROP POLICY IF EXISTS "Users can view channels in their company" ON channels;
DROP POLICY IF EXISTS "Users can view channel memberships" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can view channel members for accessible channels" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- 3. Create simple, reliable policies for channels
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id()
);

CREATE POLICY "Users can create channels in their company" 
ON channels 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id() AND 
  created_by = auth.uid()
);

CREATE POLICY "Users can update channels in their company" 
ON channels 
FOR UPDATE 
USING (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id()
);

-- 4. Create comprehensive policies for channel_members
CREATE POLICY "Users can view all channel members for their company channels" 
ON channel_members 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  auth.role() = 'authenticated' AND
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

-- 5. Ensure profiles are accessible for company members
-- (This should already exist, but let's make sure)
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
CREATE POLICY "Users can view profiles in their company" 
ON profiles 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  (company_id = get_user_company_id() OR id = auth.uid())
);


-- ============================================================================
-- Migration: 20250131120000_create_extracted_text_test_results.sql
-- ============================================================================

-- Create table for testing extracted text results
CREATE TABLE IF NOT EXISTS public.extracted_text_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT,
    extracted_text TEXT,
    assistant_response TEXT,
    openai_file_id TEXT,
    openai_thread_id TEXT,
    openai_run_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_extracted_text_test_results_created_at 
ON public.extracted_text_test_results(created_at DESC);

-- Enable RLS
ALTER TABLE public.extracted_text_test_results ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/select (for testing)
CREATE POLICY "Service role can manage test results"
ON public.extracted_text_test_results
FOR ALL
USING (true)
WITH CHECK (true);





-- ============================================================================
-- Migration: 20250815080118_c4579fdd-b0c5-4355-ab0e-2bfa41d50357.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20250818073455_324ef73c-394c-445a-8105-0e7058663b94.sql
-- ============================================================================

-- Update the handle_new_user function to work with the new auth flow
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- ============================================================================
-- Migration: 20250818082226_5541363e-4950-448e-af64-e8cf600f7cce.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20250818084933_29c3d279-79ac-440f-b80f-c46c97e71d4d.sql
-- ============================================================================

-- Fix RLS policies to allow company and onboarding session creation during signup

-- 1. Add INSERT policy for companies table
CREATE POLICY "Users can insert companies during signup" 
  ON public.companies 
  FOR INSERT 
  WITH CHECK (true);

-- 2. Add INSERT policy for onboarding_sessions table  
CREATE POLICY "Users can insert their own onboarding session" 
  ON public.onboarding_sessions 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- 3. Data fix: Create company for users who don't have one
DO $$
DECLARE
    user_record RECORD;
    new_company_id UUID;
BEGIN
    -- Find users without a company_id
    FOR user_record IN 
        SELECT id, email 
        FROM public.profiles 
        WHERE company_id IS NULL
    LOOP
        -- Create a company for this user (extract domain from email for company name)
        INSERT INTO public.companies (name, domain)
        VALUES (
            COALESCE(
                SPLIT_PART(user_record.email, '@', 2), 
                'User Company'
            ),
            SPLIT_PART(user_record.email, '@', 2)
        )
        RETURNING id INTO new_company_id;
        
        -- Update user profile with the new company_id
        UPDATE public.profiles 
        SET company_id = new_company_id 
        WHERE id = user_record.id;
        
        -- Create onboarding session if it doesn't exist
        INSERT INTO public.onboarding_sessions (
            user_id, 
            company_id, 
            current_step, 
            progress_percentage,
            status
        )
        VALUES (
            user_record.id, 
            new_company_id, 
            1, 
            0,
            'in_progress'
        )
        ON CONFLICT (user_id) DO NOTHING;
        
    END LOOP;
END $$;

-- ============================================================================
-- Migration: 20250818092642_443d46de-022d-4707-aa17-508af6857073.sql
-- ============================================================================

-- Fix RLS policies to allow company and onboarding session creation during signup

-- 1. Add INSERT policy for companies table
CREATE POLICY "Users can insert companies during signup" 
  ON public.companies 
  FOR INSERT 
  WITH CHECK (true);

-- 2. Add INSERT policy for onboarding_sessions table  
CREATE POLICY "Users can insert their own onboarding session" 
  ON public.onboarding_sessions 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- 3. Data fix: Create company for users who don't have one
DO $$
DECLARE
    user_record RECORD;
    new_company_id UUID;
    session_exists BOOLEAN;
BEGIN
    -- Find users without a company_id
    FOR user_record IN 
        SELECT id, email 
        FROM public.profiles 
        WHERE company_id IS NULL
    LOOP
        -- Create a company for this user (extract domain from email for company name)
        INSERT INTO public.companies (name, domain)
        VALUES (
            COALESCE(
                SPLIT_PART(user_record.email, '@', 2), 
                'User Company'
            ),
            SPLIT_PART(user_record.email, '@', 2)
        )
        RETURNING id INTO new_company_id;
        
        -- Update user profile with the new company_id
        UPDATE public.profiles 
        SET company_id = new_company_id 
        WHERE id = user_record.id;
        
        -- Check if onboarding session exists
        SELECT EXISTS(
            SELECT 1 FROM public.onboarding_sessions 
            WHERE user_id = user_record.id
        ) INTO session_exists;
        
        -- Create onboarding session if it doesn't exist
        IF NOT session_exists THEN
            INSERT INTO public.onboarding_sessions (
                user_id, 
                company_id, 
                current_step, 
                progress_percentage,
                status
            )
            VALUES (
                user_record.id, 
                new_company_id, 
                1, 
                0,
                'in_progress'
            );
        END IF;
        
    END LOOP;
END $$;

-- ============================================================================
-- Migration: 20250819170137_5413c05f-f0d7-4122-92fe-c47ebd2e94b5.sql
-- ============================================================================

-- Add pinecone_index_id to agents table
ALTER TABLE public.agents ADD COLUMN pinecone_index_id text;

-- Create default agent types if not exists
INSERT INTO public.agent_types (name, description, default_avatar_url) VALUES
('Marketing', 'AI assistant specialized in marketing strategies, content creation, and brand development', '/avatars/marketing.png'),
('Customer Service', 'AI assistant for customer support, issue resolution, and communication', '/avatars/customer-service.png'),
('Sales Development', 'AI assistant for lead generation, sales processes, and customer acquisition', '/avatars/sales.png'),
('Bookkeeper', 'AI assistant for financial management, accounting, and bookkeeping tasks', '/avatars/bookkeeper.png'),
('Business Analyst', 'AI assistant for data analysis, business intelligence, and strategic insights', '/avatars/analyst.png'),
('HR Journalist', 'AI assistant for human resources, recruitment, and internal communications', '/avatars/hr.png')
ON CONFLICT (name) DO NOTHING;

-- Create agent_documents table for managing document access per agent
CREATE TABLE IF NOT EXISTS public.agent_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agent_id, document_id)
);

-- Enable RLS on agent_documents
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for agent_documents
CREATE POLICY "Users can manage agent documents in their company" 
ON public.agent_documents 
FOR ALL 
USING (
  agent_id IN (
    SELECT agents.id FROM agents 
    WHERE agents.company_id = get_user_company_id()
  )
);

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  company_id uuid NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on chat_conversations
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_conversations
CREATE POLICY "Users can manage conversations in their company" 
ON public.chat_conversations 
FOR ALL 
USING (company_id = get_user_company_id());

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_messages
CREATE POLICY "Users can manage messages in their conversations" 
ON public.chat_messages 
FOR ALL 
USING (
  conversation_id IN (
    SELECT chat_conversations.id FROM chat_conversations 
    WHERE chat_conversations.company_id = get_user_company_id()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Migration: 20250819174103_0a502b12-af54-488e-9fd4-c7712ec29b27.sql
-- ============================================================================

-- Fix storage policies for document uploads during onboarding

-- Create policies for the documents bucket to allow uploads during onboarding
CREATE POLICY "Users can upload documents during onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'onboarding'
);

CREATE POLICY "Users can view their uploaded documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow access to onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    -- Allow access to company documents if user has company_id
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

CREATE POLICY "Users can update their documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

CREATE POLICY "Users can delete their documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = 'onboarding'
    OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

-- ============================================================================
-- Migration: 20250819174236_de7b1fd9-37cb-4dd4-b6f3-fba63b33a2ba.sql
-- ============================================================================

-- Fix missing RLS policies for tables used in onboarding

-- Add policies for agent_tag_assignments
CREATE POLICY "Users can manage agent tag assignments in their company"
ON public.agent_tag_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = agent_tag_assignments.agent_id
    AND a.company_id = get_user_company_id()
  )
);

-- Add policies for agent_tags  
CREATE POLICY "Users can manage agent tags in their company"
ON public.agent_tags
FOR ALL
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

-- Add policies for company_settings
CREATE POLICY "Users can view their company settings"
ON public.company_settings
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company settings"
ON public.company_settings
FOR UPDATE
USING (company_id = get_user_company_id());

-- Add policies for document_access_logs
CREATE POLICY "Users can view document access logs in their company"
ON public.document_access_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_archives da
    WHERE da.id = document_access_logs.document_id
    AND da.company_id = get_user_company_id()
  )
);

-- Add policies for document_versions
CREATE POLICY "Users can manage document versions in their company"
ON public.document_versions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.document_archives da
    WHERE da.id = document_versions.document_id
    AND da.company_id = get_user_company_id()
  )
);

-- Add policies for playbook_activity
CREATE POLICY "Users can view playbook activity in their company"
ON public.playbook_activity
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert playbook activity"
ON public.playbook_activity
FOR INSERT
WITH CHECK (company_id = get_user_company_id() AND user_id = auth.uid());

-- Add policies for usage_analytics
CREATE POLICY "Users can view usage analytics in their company"
ON public.usage_analytics
FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert usage analytics"
ON public.usage_analytics
FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Add policies for user_companies
CREATE POLICY "Users can view their company memberships"
ON public.user_companies
FOR SELECT
USING (user_id = auth.uid() OR company_id = get_user_company_id());

CREATE POLICY "Users can insert company memberships during signup"
ON public.user_companies
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Migration: 20250819174303_32baafdd-edb4-46d6-9652-5805d1c8bfe2.sql
-- ============================================================================

-- Fix function search path security issues

-- Update functions to have secure search paths
CREATE OR REPLACE FUNCTION public.get_user_company_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS app_role
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- ============================================================================
-- Migration: 20250819182114_755410ed-ee52-4b28-8eb3-976ca810c717.sql
-- ============================================================================

-- Link the existing user to the existing company
UPDATE profiles 
SET company_id = '30d23777-62d1-4a07-b28f-4972bc3ecab8'
WHERE id = '83f17ede-6cb1-4fbd-9530-ef6b60c168c0';

-- Add a policy for users to view their own profile when they don't have company_id yet
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Update companies INSERT policy to be more explicit
DROP POLICY IF EXISTS "Users can insert companies during signup" ON public.companies;
CREATE POLICY "Authenticated users can create companies" 
ON public.companies 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- Migration: 20250820105848_857691e2-4db7-4299-91c3-3f5a6b3f0e43.sql
-- ============================================================================

-- Create channels table for team collaboration
CREATE TABLE channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channels
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (company_id = get_user_company_id());

CREATE POLICY "Users can create channels in their company" 
ON channels 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND created_by = auth.uid());

CREATE POLICY "Users can update channels they created" 
ON channels 
FOR UPDATE 
USING (created_by = auth.uid() OR company_id = get_user_company_id());

-- Create channel members table
CREATE TABLE channel_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on channel_members
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channel_members
CREATE POLICY "Users can view channel members for their company channels" 
ON channel_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_members.channel_id 
  AND c.company_id = get_user_company_id()
));

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_members.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Create channel agents table
CREATE TABLE channel_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  added_by uuid NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, agent_id)
);

-- Enable RLS on channel_agents
ALTER TABLE channel_agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for channel_agents
CREATE POLICY "Users can manage channel agents for their company channels" 
ON channel_agents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_agents.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Update chat_messages table to support both direct conversations and channels
ALTER TABLE chat_messages 
ADD COLUMN channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
ADD COLUMN message_type text DEFAULT 'direct' CHECK (message_type IN ('direct', 'channel')),
ADD CONSTRAINT check_conversation_or_channel 
  CHECK ((conversation_id IS NOT NULL AND channel_id IS NULL) OR 
         (conversation_id IS NULL AND channel_id IS NOT NULL));

-- Update RLS policy for chat_messages to include channel messages
DROP POLICY IF EXISTS "Users can manage messages in their conversations" ON chat_messages;

CREATE POLICY "Users can manage messages in their conversations and channels" 
ON chat_messages 
FOR ALL 
USING (
  (conversation_id IS NOT NULL AND conversation_id IN (
    SELECT chat_conversations.id
    FROM chat_conversations
    WHERE chat_conversations.company_id = get_user_company_id()
  )) OR
  (channel_id IS NOT NULL AND channel_id IN (
    SELECT channels.id
    FROM channels
    WHERE channels.company_id = get_user_company_id()
  ))
);

-- Create indexes for performance
CREATE INDEX idx_channels_company_id ON channels(company_id);
CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX idx_channel_agents_channel_id ON channel_agents(channel_id);
CREATE INDEX idx_chat_messages_channel_id ON chat_messages(channel_id);

-- Create updated_at trigger for channels
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON channels
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration: 20250820111946_4ca7c90e-eed1-486f-b1f8-28913fe97125.sql
-- ============================================================================

-- Fix RLS policy for companies - allow authenticated users to create companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "Authenticated users can create companies" 
ON companies 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- Migration: 20250820123624_533ed3e5-c3aa-4e4c-8fad-7016c695f674.sql
-- ============================================================================

-- Add OpenAI Assistant columns to agents table
ALTER TABLE agents 
ADD COLUMN assistant_id text,
ADD COLUMN vector_store_id text;

-- Update agents table to make pinecone_index_id nullable for migration
ALTER TABLE agents 
ALTER COLUMN pinecone_index_id DROP NOT NULL;

-- ============================================================================
-- Migration: 20250820130435_0dc9f6c6-735b-48bc-963c-7c67f65395dd.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20250820135823_7aabee6a-ef93-4cf1-a75d-5f135ac49981.sql
-- ============================================================================

-- Add openai_thread_id column to chat_conversations table
ALTER TABLE public.chat_conversations 
ADD COLUMN openai_thread_id TEXT;

-- ============================================================================
-- Migration: 20250820142006_61fe14e0-1fbe-45d2-a84f-29148b7b4398.sql
-- ============================================================================

-- Create storage policies for documents bucket

-- Allow users to upload documents to their own folder
CREATE POLICY "Users can upload their own documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own documents
CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- Migration: 20250827175448_db8ac7a1-5d9c-4250-a39c-e3c365b315ca.sql
-- ============================================================================

-- Remove company_id requirement from agents table and make agents global
-- Update agents to remove company_id constraint (make it nullable for migration)
ALTER TABLE public.agents ALTER COLUMN company_id DROP NOT NULL;

-- Drop existing RLS policies on agents table
DROP POLICY IF EXISTS "Users can manage agents in their company" ON public.agents;
DROP POLICY IF EXISTS "Users can view agents in their company" ON public.agents;

-- Create new RLS policies for global agents
CREATE POLICY "Anyone can view agents" ON public.agents
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agents" ON public.agents
FOR ALL USING (get_user_role() = 'admin');

-- Update chat_conversations RLS to allow conversations with any agent
DROP POLICY IF EXISTS "Users can manage conversations in their company" ON public.chat_conversations;

CREATE POLICY "Users can manage their own conversations" ON public.chat_conversations
FOR ALL USING (user_id = auth.uid());

-- Update agent_documents RLS to work with global agents
DROP POLICY IF EXISTS "Users can manage agent documents in their company" ON public.agent_documents;

CREATE POLICY "Users can view agent documents" ON public.agent_documents
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent documents" ON public.agent_documents
FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update agent documents" ON public.agent_documents
FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete agent documents" ON public.agent_documents
FOR DELETE USING (get_user_role() = 'admin');

-- Update agent_metrics RLS to allow viewing metrics for all agents
DROP POLICY IF EXISTS "Users can view agent metrics in their company" ON public.agent_metrics;

CREATE POLICY "Users can view all agent metrics" ON public.agent_metrics
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Update agent_tag_assignments RLS for global agents
DROP POLICY IF EXISTS "Users can manage agent tag assignments in their company" ON public.agent_tag_assignments;

CREATE POLICY "Users can view agent tag assignments" ON public.agent_tag_assignments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tag assignments" ON public.agent_tag_assignments
FOR ALL USING (get_user_role() = 'admin');

-- Update agent_tags RLS to be global
DROP POLICY IF EXISTS "Users can manage agent tags in their company" ON public.agent_tags;

CREATE POLICY "Users can view agent tags" ON public.agent_tags
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tags" ON public.agent_tags
FOR ALL USING (get_user_role() = 'admin');

-- Update channel_agents RLS to allow adding any global agent to company channels
DROP POLICY IF EXISTS "Users can manage channel agents for their company channels" ON public.channel_agents;

CREATE POLICY "Users can manage channel agents for their company channels" ON public.channel_agents
FOR ALL USING (EXISTS (
  SELECT 1 FROM channels c 
  WHERE c.id = channel_agents.channel_id 
  AND c.company_id = get_user_company_id()
));

-- Clean up duplicate agents - keep one agent per agent_type_id
-- This will merge duplicate agents by keeping the most recently created one
DELETE FROM public.agents a1 
WHERE EXISTS (
  SELECT 1 FROM public.agents a2 
  WHERE a1.agent_type_id = a2.agent_type_id 
  AND a1.created_at < a2.created_at
);

-- Set remaining agents to have no company_id (making them global)
UPDATE public.agents SET company_id = NULL;

-- ============================================================================
-- Migration: 20250827183313_b969bdfb-fd70-4131-9591-fe37f48b414b.sql
-- ============================================================================

-- Create consultation_messages table for admin-client communication
CREATE TABLE public.consultation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_request_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'user')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_document_request BOOLEAN NOT NULL DEFAULT false,
  is_note BOOLEAN NOT NULL DEFAULT false,
  is_private_note BOOLEAN NOT NULL DEFAULT false,
  documents_requested TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for consultation messages
CREATE POLICY "Admins can manage all consultation messages" 
ON public.consultation_messages 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

CREATE POLICY "Users can view messages for their consultation requests" 
ON public.consultation_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages for their consultation requests" 
ON public.consultation_messages 
FOR INSERT 
WITH CHECK (
  sender_type = 'user' AND
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

-- Update consultation_requests status to use proper enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
        CREATE TYPE consultation_status AS ENUM ('requested', 'in_progress', 'completed', 'on_hold');
    END IF;
END $$;

-- Update the consultation_requests table to use the enum
ALTER TABLE public.consultation_requests 
ALTER COLUMN status TYPE consultation_status USING status::consultation_status;

-- ============================================================================
-- Migration: 20250827184034_1a58b3b4-0ad6-4715-bbe3-e940b2ac6540.sql
-- ============================================================================

-- Create consultation_messages table for admin-client communication
CREATE TABLE public.consultation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_request_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'user')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_document_request BOOLEAN NOT NULL DEFAULT false,
  is_note BOOLEAN NOT NULL DEFAULT false,
  is_private_note BOOLEAN NOT NULL DEFAULT false,
  documents_requested TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for consultation messages
CREATE POLICY "Admins can manage all consultation messages" 
ON public.consultation_messages 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

CREATE POLICY "Users can view messages for their consultation requests" 
ON public.consultation_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages for their consultation requests" 
ON public.consultation_messages 
FOR INSERT 
WITH CHECK (
  sender_type = 'user' AND
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

-- ============================================================================
-- Migration: 20250828071415_26a99c9c-2ba5-45bc-a870-2b7a51d03f38.sql
-- ============================================================================

-- Create function for matching documents using vector similarity
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_company_id uuid,
  p_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  document_archive_id uuid,
  file_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity,
    d.document_archive_id,
    da.file_name
  FROM documents d
  LEFT JOIN document_archives da ON d.document_archive_id = da.id
  WHERE d.company_id = p_company_id
    AND d.embedding IS NOT NULL
    AND (d.agent_id IS NULL OR d.agent_id = p_agent_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Migration: 20250828071442_0319e61b-59af-4303-a617-93e015b4c606.sql
-- ============================================================================

-- Update function with proper security settings
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_company_id uuid,
  p_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  document_archive_id uuid,
  file_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity,
    d.document_archive_id,
    da.file_name
  FROM documents d
  LEFT JOIN document_archives da ON d.document_archive_id = da.id
  WHERE d.company_id = p_company_id
    AND d.embedding IS NOT NULL
    AND (d.agent_id IS NULL OR d.agent_id = p_agent_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Migration: 20250828072901_ec3c7fdf-e3e1-4010-8d16-28788841754d.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20250829054133_c919bf21-d0c0-40a7-b755-d2c2b825b8b8.sql
-- ============================================================================

-- Create tools table to define available tools in the system
CREATE TABLE public.tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  tool_type TEXT NOT NULL, -- 'gsuite', 'slack', 'stripe', etc.
  schema_definition JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_tools table to link agents with their available tools
CREATE TABLE public.agent_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  tool_id UUID NOT NULL,
  configuration JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE,
  UNIQUE(agent_id, tool_id)
);

-- Enable RLS
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

-- Create policies for tools
CREATE POLICY "Anyone can view tools" 
ON public.tools 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage tools" 
ON public.tools 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

-- Create policies for agent_tools
CREATE POLICY "Users can view agent tools" 
ON public.agent_tools 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage agent tools" 
ON public.agent_tools 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

-- Insert default G Suite tools
INSERT INTO public.tools (name, display_name, description, tool_type, schema_definition) VALUES
('gmail_search', 'Gmail Search', 'Search Gmail messages', 'gsuite', '{
  "actions": ["search"],
  "parameters": {
    "search": {
      "query": {"type": "string", "required": true},
      "maxResults": {"type": "number", "default": 10},
      "timeRange": {"type": "string", "enum": ["today", "yesterday", "week", "month"]}
    }
  }
}'::jsonb),
('drive_search', 'Google Drive Search', 'Search Google Drive files', 'gsuite', '{
  "actions": ["search"],
  "parameters": {
    "search": {
      "query": {"type": "string", "required": true},
      "fileType": {"type": "string", "enum": ["document", "spreadsheet", "presentation", "pdf"]},
      "maxResults": {"type": "number", "default": 10}
    }
  }
}'::jsonb),
('docs_read', 'Google Docs Reader', 'Read Google Documents content', 'gsuite', '{
  "actions": ["read"],
  "parameters": {
    "read": {
      "documentId": {"type": "string", "required": true}
    }
  }
}'::jsonb),
('sheets_read', 'Google Sheets Reader', 'Read Google Sheets data', 'gsuite', '{
  "actions": ["read"],
  "parameters": {
    "read": {
      "spreadsheetId": {"type": "string", "required": true},
      "range": {"type": "string"}
    }
  }
}'::jsonb);

-- Create trigger for updated_at
CREATE TRIGGER update_tools_updated_at
BEFORE UPDATE ON public.tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Migration: 20250829054524_a07659e0-0217-4408-8d11-87c3844844f9.sql
-- ============================================================================

-- Create default agent-tool relationships for existing agents
DO $$
DECLARE
    agent_rec RECORD;
    tool_rec RECORD;
BEGIN
    -- For each existing agent, assign all G Suite tools by default
    FOR agent_rec IN (SELECT id FROM public.agents) LOOP
        FOR tool_rec IN (SELECT id FROM public.tools WHERE tool_type = 'gsuite') LOOP
            INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled)
            VALUES (agent_rec.id, tool_rec.id, true)
            ON CONFLICT (agent_id, tool_id) DO NOTHING;
        END LOOP;
    END LOOP;
END
$$;

-- ============================================================================
-- Migration: 20250901124447_4edfddc7-d4eb-4b55-b226-eab8563a8e96.sql
-- ============================================================================

-- Add system_instructions column to agents table
ALTER TABLE public.agents ADD COLUMN system_instructions TEXT;

-- ============================================================================
-- Migration: 20250904110812_30791d1e-8fd9-4ba8-9f14-95a29df9c33b.sql
-- ============================================================================

-- Add Calendar Tools to the tools table
INSERT INTO tools (id, name, display_name, description, tool_type, schema_definition, is_active) VALUES
  (
    gen_random_uuid(),
    'calendar_list_events',
    'Google Calendar Events',
    'List and search Google Calendar events',
    'gsuite',
    '{
      "actions": ["list", "search"],
      "parameters": {
        "list": {
          "calendarId": {"type": "string", "default": "primary"},
          "timeMin": {"type": "string", "description": "ISO 8601 datetime"},
          "timeMax": {"type": "string", "description": "ISO 8601 datetime"},
          "maxResults": {"type": "number", "default": 10},
          "query": {"type": "string", "description": "Search query"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_create_event',
    'Create Calendar Event',
    'Create new Google Calendar events',
    'gsuite',
    '{
      "actions": ["create"],
      "parameters": {
        "create": {
          "summary": {"type": "string", "required": true},
          "description": {"type": "string"},
          "start": {"type": "object", "required": true},
          "end": {"type": "object", "required": true},
          "location": {"type": "string"},
          "attendees": {"type": "array"},
          "calendarId": {"type": "string", "default": "primary"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_update_event',
    'Update Calendar Event',
    'Update existing Google Calendar events',
    'gsuite',
    '{
      "actions": ["update"],
      "parameters": {
        "update": {
          "eventId": {"type": "string", "required": true},
          "summary": {"type": "string"},
          "description": {"type": "string"},
          "start": {"type": "object"},
          "end": {"type": "object"},
          "location": {"type": "string"},
          "attendees": {"type": "array"},
          "calendarId": {"type": "string", "default": "primary"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_delete_event',
    'Delete Calendar Event',
    'Delete Google Calendar events',
    'gsuite',
    '{
      "actions": ["delete"],
      "parameters": {
        "delete": {
          "eventId": {"type": "string", "required": true},
          "calendarId": {"type": "string", "default": "primary"},
          "sendUpdates": {"type": "string", "enum": ["all", "externalOnly", "none"], "default": "all"}
        }
      }
    }'::jsonb,
    true
  );

-- ============================================================================
-- Migration: 20250908154603_0a40fd94-bc18-416f-b2b5-663801c62c9d.sql
-- ============================================================================

-- Add nickname column to agents table for tagging functionality
ALTER TABLE public.agents 
ADD COLUMN nickname text;

-- Add unique constraint for nickname within each company to prevent duplicates
ALTER TABLE public.agents 
ADD CONSTRAINT agents_nickname_company_unique 
UNIQUE (nickname, company_id);

-- ============================================================================
-- Migration: 20250909112733_594032b8-8848-4a93-ba3d-31b9d3c7f347.sql
-- ============================================================================

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', false, 52428800, ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

-- Add attachments column to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Create RLS policies for chat-files bucket
CREATE POLICY "Users can view chat files from their company" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'chat-files' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can upload chat files to their company folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update chat files they uploaded" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete chat files they uploaded" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'chat-files' 
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ============================================================================
-- Migration: 20250909114302_1c4b517f-0552-4cd5-9ebd-c81da00c476a.sql
-- ============================================================================

-- Make conversation_id nullable in chat_messages table to support channel messages
ALTER TABLE public.chat_messages 
ALTER COLUMN conversation_id DROP NOT NULL;

-- ============================================================================
-- Migration: 20250910141057_d2229919-2010-4789-b774-38e1607f85da.sql
-- ============================================================================

-- Add user_id column to chat_messages table to fix relationship with profiles
ALTER TABLE public.chat_messages 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- ============================================================================
-- Migration: 20250911085055_60001a6a-7eef-4257-b4bd-d854382a8ba9.sql
-- ============================================================================

-- Enable real-time for chat_messages table
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================================
-- Migration: 20250911133528_1773582b-58e6-453d-aedb-8a039cc74cc1.sql
-- ============================================================================

-- Add mention_type field to chat_messages table to differentiate between direct mentions in channels and direct conversations
ALTER TABLE public.chat_messages 
ADD COLUMN mention_type text CHECK (mention_type IN ('direct_mention', 'direct_conversation'));

-- Add comment for clarity
COMMENT ON COLUMN public.chat_messages.mention_type IS 'Differentiates between agent mentions in channels (direct_mention) and direct conversations with agents (direct_conversation)';

-- ============================================================================
-- Migration: 20250922000001_add_openai_tools.sql
-- ============================================================================

-- Add OpenAI tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'openai_image_generation',
  'OpenAI Image Generation',
  'openai',
  'Generate images using OpenAI DALL-E',
  '{
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "The text prompt describing the image to generate"
      },
      "size": {
        "type": "string",
        "enum": ["1024x1024", "1792x1024", "1024x1792"],
        "default": "1024x1024",
        "description": "The size of the generated image"
      },
      "quality": {
        "type": "string",
        "enum": ["standard", "hd"],
        "default": "standard",
        "description": "The quality of the generated image"
      },
      "n": {
        "type": "integer",
        "minimum": 1,
        "maximum": 4,
        "default": 1,
        "description": "Number of images to generate"
      }
    },
    "required": ["prompt"]
  }'::jsonb
),
(
  'openai_web_research',
  'OpenAI Web Research',
  'openai',
  'Perform web research using OpenAI with web browsing capability',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The research query or topic to investigate"
      },
      "focus_areas": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific areas or aspects to focus the research on"
      },
      "depth": {
        "type": "string",
        "enum": ["quick", "detailed", "comprehensive"],
        "default": "detailed",
        "description": "The depth of research to perform"
      },
      "include_sources": {
        "type": "boolean",
        "default": true,
        "description": "Whether to include source citations in the results"
      }
    },
    "required": ["query"]
  }'::jsonb
);

-- Add new message content types to support OpenAI tool results
ALTER TABLE public.chat_messages 
ADD COLUMN tool_results JSONB DEFAULT NULL,
ADD COLUMN content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image_generation', 'web_research', 'mixed'));

-- Create index on content_type for better query performance
CREATE INDEX idx_chat_messages_content_type ON public.chat_messages(content_type);

-- Add OpenAI tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'openai'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add OpenAI tools to new agents
CREATE OR REPLACE FUNCTION add_openai_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all OpenAI tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'openai';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add OpenAI tools to new agents
CREATE TRIGGER trigger_add_openai_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_openai_tools_to_new_agent();


-- ============================================================================
-- Migration: 20250922000002_add_chat_message_columns.sql
-- ============================================================================

-- Add new message content types to support OpenAI tool results
-- This is a minimal migration to fix the immediate 400 error
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS tool_results JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text';

-- Add check constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'chat_messages' 
        AND constraint_name = 'chat_messages_content_type_check'
    ) THEN
        ALTER TABLE public.chat_messages 
        ADD CONSTRAINT chat_messages_content_type_check 
        CHECK (content_type IN ('text', 'image_generation', 'web_research', 'mixed'));
    END IF;
END $$;

-- Create index on content_type for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_type ON public.chat_messages(content_type);

-- Create storage bucket for chat attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
  'chat-attachments', 
  'chat-attachments', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json']
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments'
);

-- Set up RLS policies for the chat-attachments bucket
DO $$ 
BEGIN
  -- Policy for viewing chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view chat attachments'
  ) THEN
    CREATE POLICY "Anyone can view chat attachments" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-attachments');
  END IF;

  -- Policy for uploading chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);
  END IF;

  -- Policy for updating chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own chat attachments'
  ) THEN
    CREATE POLICY "Users can update their own chat attachments" ON storage.objects
    FOR UPDATE USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Policy for deleting chat attachments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own chat attachments'
  ) THEN
    CREATE POLICY "Users can delete their own chat attachments" ON storage.objects
    FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Success message
SELECT 'Image generation migration with storage bucket applied successfully!' as status;


-- ============================================================================
-- Migration: 20251001132543_cc56ef53-fc40-41e4-95d3-5a183b8e7e76.sql
-- ============================================================================

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

-- ============================================================================
-- Migration: 20251001133305_9259ee3a-05b6-4517-923a-d10c212ffd1a.sql
-- ============================================================================

-- Function to log chat message activities
CREATE OR REPLACE FUNCTION public.log_chat_message_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_channel_name text;
  v_title text;
  v_desc text;
  v_target_type text;
  v_target_id uuid;
  v_tags text[] := ARRAY['message'];
  v_category text := 'communication';
  v_type text;
BEGIN
  -- Determine company and target
  IF NEW.conversation_id IS NOT NULL THEN
    SELECT company_id INTO v_company_id FROM chat_conversations WHERE id = NEW.conversation_id;
    v_target_type := 'conversation';
    v_target_id := NEW.conversation_id;
  ELSIF NEW.channel_id IS NOT NULL THEN
    SELECT company_id, name INTO v_company_id, v_channel_name FROM channels WHERE id = NEW.channel_id;
    v_target_type := 'channel';
    v_target_id := NEW.channel_id;
  END IF;

  -- Build title and description
  v_desc := LEFT(COALESCE(NEW.content, ''), 140);
  IF NEW.agent_id IS NOT NULL OR NEW.role = 'assistant' THEN
    v_type := 'agent_message';
    v_title := COALESCE((SELECT name FROM agents WHERE id = NEW.agent_id), 'AI Agent') ||
               CASE WHEN v_channel_name IS NOT NULL THEN ' responded in #' || v_channel_name ELSE '' END;
  ELSE
    v_type := 'user_message';
    v_title := 'User message' || CASE WHEN v_channel_name IS NOT NULL THEN ' in #' || v_channel_name ELSE '' END;
  END IF;

  -- Insert activity
  INSERT INTO public.user_activities (
    user_id,
    company_id,
    agent_id,
    activity_type,
    activity_category,
    title,
    description,
    metadata,
    target_resource_type,
    target_resource_id,
    status,
    tags
  ) VALUES (
    NEW.user_id,
    v_company_id,
    NEW.agent_id,
    v_type,
    v_category,
    v_title,
    v_desc,
    jsonb_build_object(
      'message_id', NEW.id,
      'channel_name', v_channel_name
    ),
    v_target_type,
    v_target_id,
    'completed',
    v_tags
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_chat_message_activity ON public.chat_messages;
CREATE TRIGGER trg_log_chat_message_activity
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.log_chat_message_activity();

-- Function to log agent tag assignment activities
CREATE OR REPLACE FUNCTION public.log_agent_tag_assignment_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_agent_name text;
  v_tag_name text;
BEGIN
  SELECT a.company_id, a.name INTO v_company_id, v_agent_name FROM agents a WHERE a.id = NEW.agent_id;
  SELECT t.name INTO v_tag_name FROM agent_tags t WHERE t.id = NEW.tag_id;

  INSERT INTO public.user_activities (
    user_id,
    company_id,
    agent_id,
    activity_type,
    activity_category,
    title,
    description,
    metadata,
    target_resource_type,
    target_resource_id,
    status,
    tags
  ) VALUES (
    NEW.added_by,
    v_company_id,
    NEW.agent_id,
    'agent_tag_assigned',
    'tagging',
    'Tag "' || COALESCE(v_tag_name, 'tag') || '" added to ' || COALESCE(v_agent_name, 'agent'),
    NULL,
    jsonb_build_object('tag_id', NEW.tag_id, 'tag_name', v_tag_name),
    'agent',
    NEW.agent_id,
    'completed',
    ARRAY['tag','agent']
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agent_tag_assignment_activity ON public.agent_tag_assignments;
CREATE TRIGGER trg_log_agent_tag_assignment_activity
AFTER INSERT ON public.agent_tag_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_agent_tag_assignment_activity();

-- ============================================================================
-- Migration: 20251001160004_7ca92bf2-4914-4525-96f4-b91f7e232854.sql
-- ============================================================================

-- Standardize agent configuration schema
-- Migrate existing configurations to include new required fields

-- Update agents with existing configuration
UPDATE agents 
SET configuration = jsonb_build_object(
  'ai_provider', COALESCE(configuration->>'ai_provider', 'openai'),
  'ai_model', COALESCE(configuration->>'ai_model', configuration->>'model', 'gpt-4o-mini'),
  'temperature', COALESCE((configuration->>'temperature')::numeric, 0.7),
  'max_tokens', COALESCE((configuration->>'max_tokens')::integer, 2000),
  'web_access', COALESCE((configuration->>'web_access')::boolean, false)
)
WHERE configuration IS NOT NULL AND configuration != '{}';

-- Handle agents with empty or null configuration
UPDATE agents 
SET configuration = jsonb_build_object(
  'ai_provider', 'openai',
  'ai_model', 'gpt-4o-mini',
  'temperature', 0.7,
  'max_tokens', 2000,
  'web_access', false
)
WHERE configuration IS NULL OR configuration = '{}';

-- ============================================================================
-- Migration: 20251002000000_add_document_analysis_support.sql
-- ============================================================================

-- Add support for document_analysis content type
-- This migration ensures the chat_messages table can properly store document analysis data

-- Update the content_type column to include document_analysis if it's constrained
-- Note: If content_type is already unconstrained text, this is just for documentation

-- Add index for faster queries on document analysis messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_document_analysis 
ON chat_messages(content_type) 
WHERE content_type = 'document_analysis';

-- Add index on content_metadata for AI provider queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_metadata_provider
ON chat_messages USING GIN (content_metadata)
WHERE content_metadata ? 'aiProvider';

-- Add comment to document the new content type
COMMENT ON COLUMN chat_messages.content_type IS 
'Type of content in the message. Valid values: text, image_generation, web_research, document_analysis, mixed';

-- Add comment to document the rich_content structure for document analysis
COMMENT ON COLUMN chat_messages.rich_content IS 
'Rich content object containing structured data. For document_analysis type, includes: 
{
  "title": "Analysis title",
  "content": "Formatted markdown content",
  "outline": ["Heading 1", "Heading 2"],
  "documentSource": "original_filename.pdf",
  "structuredAnalysis": {
    "executiveSummary": "...",
    "keyFindings": [],
    "mainThemes": [],
    "importantDataPoints": [],
    "recommendations": [],
    "detailedAnalysis": "...",
    "documentType": "...",
    "confidenceScore": 0.85
  },
  "aiProvider": "openai|google|anthropic",
  "aiModel": "model-name",
  "generatedAt": "ISO timestamp",
  "wordCount": 1234
}';

-- Add comment to document content_metadata for document analysis
COMMENT ON COLUMN chat_messages.content_metadata IS 
'Metadata about the message content. For document_analysis type, includes:
{
  "status": "completed|generating|error",
  "documentName": "filename.pdf",
  "generatedAt": "ISO timestamp",
  "wordCount": 1234,
  "aiProvider": "openai|google|anthropic",
  "aiModel": "model-name",
  "confidenceScore": 0.85
}';



-- ============================================================================
-- Migration: 20251002100832_c59b8d18-f925-4dfe-800a-ee64865f9f5f.sql
-- ============================================================================

-- Add columns to document_archives for playbook integration
ALTER TABLE document_archives 
ADD COLUMN IF NOT EXISTS playbook_section_id uuid REFERENCES playbook_sections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_editable boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_archives_section_id ON document_archives(playbook_section_id);
CREATE INDEX IF NOT EXISTS idx_document_archives_editable ON document_archives(is_editable);

-- Function to create default playbook sections for a new company
CREATE OR REPLACE FUNCTION create_default_playbook_sections(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sections text[][] := ARRAY[
    ARRAY['Mission & Vision', 'mission-vision', 'Define your company''s purpose, core values, and long-term aspirations'],
    ARRAY['Value Proposition', 'value-proposition', 'Articulate the unique value you provide to customers'],
    ARRAY['Customer Segments', 'customer-segments', 'Identify and describe your target customer groups'],
    ARRAY['SWOT Analysis', 'swot', 'Analyze strengths, weaknesses, opportunities, and threats'],
    ARRAY['Standard Operating Procedures', 'sops', 'Document step-by-step processes for key operations'],
    ARRAY['Team Roles & Responsibilities', 'team-roles', 'Define organizational structure and role expectations'],
    ARRAY['Tools & Integrations', 'tools', 'List and describe your technology stack and integrations'],
    ARRAY['Compliance & Legal', 'compliance-legal', 'Document compliance requirements and legal considerations']
  ];
  section_data text[];
  section_order_num integer := 0;
BEGIN
  FOREACH section_data SLICE 1 IN ARRAY sections
  LOOP
    INSERT INTO playbook_sections (
      company_id,
      title,
      content,
      tags,
      status,
      progress_percentage,
      section_order
    ) VALUES (
      p_company_id,
      section_data[1],
      section_data[3],
      ARRAY[section_data[2], 'default-template'],
      'draft',
      0,
      section_order_num
    );
    section_order_num := section_order_num + 1;
  END LOOP;
END;
$$;

-- Trigger to automatically create playbook sections when a company is created
CREATE OR REPLACE FUNCTION trigger_create_default_playbook_sections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_default_playbook_sections(NEW.id);
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_company_created_create_playbook_sections ON companies;
CREATE TRIGGER on_company_created_create_playbook_sections
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_playbook_sections();

-- Create default sections for existing companies that don't have any
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT c.id 
    FROM companies c
    LEFT JOIN playbook_sections ps ON ps.company_id = c.id
    WHERE ps.id IS NULL
    GROUP BY c.id
  LOOP
    PERFORM create_default_playbook_sections(company_record.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- Migration: 20251002120000_create_team_invitations.sql
-- ============================================================================

-- Create team_invitations table
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  personal_message TEXT,
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX idx_team_invitations_company_id ON team_invitations(company_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(invitation_token);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_invited_by ON team_invitations(invited_by);

-- Enable Row Level Security
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view invitations they sent
CREATE POLICY "Users can view invitations they sent"
  ON team_invitations
  FOR SELECT
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can create invitations for their company
CREATE POLICY "Users can create invitations for their company"
  ON team_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can update invitations they sent (e.g., to cancel)
CREATE POLICY "Users can update invitations they sent"
  ON team_invitations
  FOR UPDATE
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role IN ('admin', 'moderator'))
  );

-- Users can delete invitations they sent
CREATE POLICY "Users can delete invitations they sent"
  ON team_invitations
  FOR DELETE
  USING (
    invited_by = auth.uid() OR
    auth.uid() IN (SELECT id FROM profiles WHERE company_id = team_invitations.company_id AND role = 'admin')
  );

-- Create function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Create a trigger to check for expired invitations periodically
-- Note: In production, you might want to use a cron job or edge function for this
CREATE OR REPLACE FUNCTION check_invitation_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expires_at < NOW() AND NEW.status = 'pending' THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invitation_expiry_check
  BEFORE INSERT OR UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION check_invitation_expiry();

-- Add helpful comments
COMMENT ON TABLE team_invitations IS 'Stores team member invitation information';
COMMENT ON COLUMN team_invitations.invitation_token IS 'Unique token used in invitation URLs';
COMMENT ON COLUMN team_invitations.expires_at IS 'When the invitation expires (default 7 days)';
COMMENT ON COLUMN team_invitations.status IS 'Current status of the invitation';



-- ============================================================================
-- Migration: 20251002120000_fix_storage_policies.sql
-- ============================================================================

-- Fix storage policies for documents bucket
-- Drop all existing conflicting policies and create consolidated ones

-- Drop all existing policies for documents bucket (if they exist)
DROP POLICY IF EXISTS "Users can upload documents during onboarding" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their uploaded documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their company folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents from their company folder" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "documents_bucket_delete_policy" ON storage.objects;

-- Create consolidated storage policies for documents bucket
-- These policies allow users to manage documents in their company folder

CREATE POLICY "documents_bucket_insert_policy" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow uploads to company folder (first folder = company_id)
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow uploads directly to onboarding folder during setup
    (storage.foldername(name))[1] = 'onboarding'
  )
);

CREATE POLICY "documents_bucket_select_policy" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow viewing company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow viewing onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow viewing own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "documents_bucket_update_policy" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow updating company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow updating onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow updating own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "documents_bucket_delete_policy" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Allow deleting company folder documents
    (storage.foldername(name))[1] IN (
      SELECT company_id::text 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow deleting onboarding documents
    (storage.foldername(name))[1] = 'onboarding'
    OR
    -- Allow deleting own user folder
    (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Ensure the documents bucket exists and has the correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];



-- ============================================================================
-- Migration: 20251002121500_simple_storage_fix.sql
-- ============================================================================

-- Simple fix for storage policies - more permissive approach
-- This ensures authenticated users can upload documents

-- First, let's see what policies exist and drop them all
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname LIKE '%document%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Create simple, permissive policies for authenticated users
-- Allow authenticated users to upload to documents bucket
CREATE POLICY "authenticated_users_can_insert_documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view documents
CREATE POLICY "authenticated_users_can_select_documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update documents
CREATE POLICY "authenticated_users_can_update_documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete documents
CREATE POLICY "authenticated_users_can_delete_documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

-- Ensure the documents bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];



-- ============================================================================
-- Migration: 20251002122000_fix_document_archives_policy.sql
-- ============================================================================

-- Fix document_archives RLS policies to allow uploads during onboarding

-- Drop existing restrictive policies for document_archives
DROP POLICY IF EXISTS "Users can insert documents in their company" ON public.document_archives;
DROP POLICY IF EXISTS "Users can update documents in their company" ON public.document_archives;
DROP POLICY IF EXISTS "Users can view documents in their company" ON public.document_archives;

-- Create more permissive policies that work during onboarding
-- Allow authenticated users to insert documents (they can only insert to their company anyway)
CREATE POLICY "authenticated_users_can_insert_documents" 
ON public.document_archives 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    -- Allow if company_id matches user's company
    company_id = public.get_user_company_id()
    OR
    -- Allow if user has a company_id in their profile (for onboarding)
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
    OR
    -- Allow during onboarding when profile doesn't have company_id yet
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Allow users to view documents from their company
CREATE POLICY "users_can_view_company_documents" 
ON public.document_archives 
FOR SELECT 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

-- Allow users to update documents in their company
CREATE POLICY "users_can_update_company_documents" 
ON public.document_archives 
FOR UPDATE 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);

-- Allow users to delete documents in their company
CREATE POLICY "users_can_delete_company_documents" 
ON public.document_archives 
FOR DELETE 
USING (
  auth.role() = 'authenticated'
  AND (
    company_id = public.get_user_company_id()
    OR
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND company_id IS NOT NULL
    )
  )
);



-- ============================================================================
-- Migration: 20251002122027_3396365c-bdba-46e8-a17b-b9fbb7bf0414.sql
-- ============================================================================

-- Add 'document_analysis' to the content_type constraint
-- This allows the generate-rich-content edge function to save document analysis results

-- Drop the existing constraint
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;

-- Recreate the constraint with document_analysis included
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_type_check 
CHECK (content_type IN ('text', 'image_generation', 'web_research', 'document_analysis', 'mixed'));

-- Verify the constraint was created correctly
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'chat_messages'::regclass 
AND conname = 'chat_messages_content_type_check';

-- Display current content_type usage
SELECT content_type, COUNT(*) as count
FROM chat_messages 
GROUP BY content_type
ORDER BY content_type;

-- ============================================================================
-- Migration: 20251002122500_simplify_document_archives_policy.sql
-- ============================================================================

-- Simplify document_archives RLS policies - super permissive for authenticated users

-- Drop all existing policies for document_archives
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'document_archives' 
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.document_archives';
    END LOOP;
END $$;

-- Create simple policies that just check authentication
CREATE POLICY "authenticated_insert_document_archives" 
ON public.document_archives 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_select_document_archives" 
ON public.document_archives 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_document_archives" 
ON public.document_archives 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_delete_document_archives" 
ON public.document_archives 
FOR DELETE 
USING (auth.role() = 'authenticated');



-- ============================================================================
-- Migration: 20251002155207_fix_storage_policies.sql
-- ============================================================================

ÿþF i x  
 s t o r a g e  
 p o l i c i e s  
 f o r  
 d o c u m e n t s  
 b u c k e t  
 

-- ============================================================================
-- Migration: 20251002160000_add_chat_messages_foreign_keys.sql
-- ============================================================================

-- Add missing foreign key relationships for chat_messages table

-- Add foreign key for user_id if the column exists
DO $$ 
BEGIN
    -- Check if user_id column exists before adding foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'user_id'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'chat_messages_user_id_fkey'
            AND table_name = 'chat_messages'
        ) THEN
            ALTER TABLE public.chat_messages
            ADD CONSTRAINT chat_messages_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON public.chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);



-- ============================================================================
-- Migration: 20251002160500_add_playbook_insert_policy.sql
-- ============================================================================

-- Add INSERT policy for playbook_sections to allow all company users to create sections
CREATE POLICY "Users can insert playbook sections in their company" 
ON public.playbook_sections
FOR INSERT 
WITH CHECK (company_id = public.get_user_company_id());



-- ============================================================================
-- Migration: 20251002180000_notification_settings_system.sql
-- ============================================================================

-- Complete Notification Settings System
-- This migration creates the user_notification_settings table and all necessary triggers

-- 1. Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS public.user_notification_settings CASCADE;

-- Create user_notification_settings table
CREATE TABLE public.user_notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can manage their own notification settings" ON public.user_notification_settings;
CREATE POLICY "Users can manage their own notification settings"
ON public.user_notification_settings FOR ALL
USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user_id ON user_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_type ON user_notification_settings(notification_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON public.user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
BEFORE UPDATE ON public.user_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Function to Initialize User Notification Preferences
CREATE OR REPLACE FUNCTION public.initialize_user_notification_settings(p_user_id uuid)
RETURNS void AS $$
DECLARE
  notification_types text[] := ARRAY[
    'mention', 'channel_message', 'agent_response', 
    'channel_created', 'channel_updated', 
    'document_shared', 'playbook_updated', 
    'system_alert', 'member_added', 'member_removed',
    'integration_connected', 'integration_error', 'webhook_received'
  ];
  notif_type text;
  email_default boolean;
BEGIN
  FOREACH notif_type IN ARRAY notification_types LOOP
    -- High priority notifications have email ON by default
    email_default := notif_type IN ('mention', 'system_alert', 'integration_error', 'agent_response');
    
    INSERT INTO user_notification_settings (user_id, notification_type, enabled, email_enabled)
    VALUES (p_user_id, notif_type, true, email_default)
    ON CONFLICT (user_id, notification_type) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to Initialize Settings on User Creation
CREATE OR REPLACE FUNCTION public.initialize_notification_settings_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_notification_settings(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_initialize_notification_settings ON public.profiles;
CREATE TRIGGER trigger_initialize_notification_settings
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_notification_settings_on_signup();

-- 4. Initialize settings for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM profiles LOOP
    PERFORM initialize_user_notification_settings(user_record.id);
  END LOOP;
END $$;

-- 5. Document Shared Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_document_shared()
RETURNS TRIGGER AS $$
DECLARE
  company_members RECORD;
  uploader_name text;
  document_name text;
BEGIN
  -- Get uploader info
  SELECT first_name, last_name INTO uploader_name
  FROM profiles
  WHERE id = NEW.uploaded_by;
  
  uploader_name := COALESCE(uploader_name, 'Someone');
  document_name := NEW.file_name;

  -- Notify all company members except uploader
  FOR company_members IN 
    SELECT id, first_name, last_name 
    FROM profiles 
    WHERE company_id = NEW.company_id 
    AND id != NEW.uploaded_by
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_by
    ) VALUES (
      company_members.id,
      'document_shared',
      'Document shared: ' || document_name,
      uploader_name || ' shared "' || document_name || '"',
      jsonb_build_object(
        'document_name', document_name,
        'shared_by', uploader_name,
        'jump_url', '/documents'
      ),
      NEW.uploaded_by
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_document_shared ON public.document_archives;
CREATE TRIGGER trigger_notify_document_shared
AFTER INSERT ON public.document_archives
FOR EACH ROW
EXECUTE FUNCTION public.notify_document_shared();

-- 6. Playbook Updated Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_playbook_updated()
RETURNS TRIGGER AS $$
DECLARE
  company_members RECORD;
  updater_name text;
BEGIN
  -- Only notify on updates, not inserts
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get updater info
  SELECT first_name, last_name INTO updater_name
  FROM profiles
  WHERE id = NEW.updated_by;
  
  updater_name := COALESCE(updater_name, 'Someone');

  -- Notify all company members except updater
  FOR company_members IN 
    SELECT id, first_name, last_name 
    FROM profiles 
    WHERE company_id = NEW.company_id 
    AND id != NEW.updated_by
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_by
    ) VALUES (
      company_members.id,
      'playbook_updated',
      'Playbook updated',
      updater_name || ' updated the company playbook',
      jsonb_build_object(
        'playbook_name', 'Company Playbook',
        'updated_by', updater_name,
        'jump_url', '/playbook'
      ),
      NEW.updated_by
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_playbook_updated ON public.playbook_sections;
CREATE TRIGGER trigger_notify_playbook_updated
AFTER UPDATE ON public.playbook_sections
FOR EACH ROW
EXECUTE FUNCTION public.notify_playbook_updated();

-- 7. Channel Member Removed Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_member_removed()
RETURNS TRIGGER AS $$
DECLARE
  channel_name text;
  removed_user_name text;
BEGIN
  -- Get channel name
  SELECT name INTO channel_name
  FROM channels
  WHERE id = OLD.channel_id;

  -- Get removed user name
  SELECT first_name, last_name INTO removed_user_name
  FROM profiles
  WHERE id = OLD.user_id;

  removed_user_name := COALESCE(removed_user_name, 'A member');

  -- Notify the removed user
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    channel_id
  ) VALUES (
    OLD.user_id,
    'member_removed',
    'Removed from #' || channel_name,
    'You were removed from #' || channel_name,
    jsonb_build_object(
      'channel_name', channel_name,
      'member_name', removed_user_name,
      'jump_url', '/channels'
    ),
    OLD.channel_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_member_removed ON public.channel_members;
CREATE TRIGGER trigger_notify_member_removed
AFTER DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_member_removed();

-- 8. Integration Connected/Error Notifications (manual trigger via app)
-- These will be called from the application code when integrations connect/fail

-- 9. System Alert Notifications (manual trigger via admin)
-- These will be created by admins through the admin panel

-- 10. Webhook Received Notifications (manual trigger via webhook handlers)
-- These will be called when external webhooks are received

COMMENT ON TABLE user_notification_settings IS 'Stores user preferences for notification types and delivery methods';
COMMENT ON FUNCTION initialize_user_notification_settings IS 'Initializes default notification settings for a user with all 13 notification types';
COMMENT ON FUNCTION notify_document_shared IS 'Creates notifications when documents are shared/uploaded';
COMMENT ON FUNCTION notify_playbook_updated IS 'Creates notifications when playbook sections are updated';
COMMENT ON FUNCTION notify_member_removed IS 'Creates notifications when users are removed from channels';



-- ============================================================================
-- Migration: 20251002190000_implement_role_based_access.sql
-- ============================================================================

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



-- ============================================================================
-- Migration: 20251002200000_update_content_type_constraint.sql
-- ============================================================================

-- Update content_type constraint to include 'document_analysis'
-- First drop the old constraint if it exists
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_content_type_check;

-- Add the updated constraint with document_analysis
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_type_check 
CHECK (content_type IN ('text', 'image_generation', 'web_research', 'document_analysis', 'mixed'));



-- ============================================================================
-- Migration: 20251005205803_48a3582c-f6d3-45fe-9290-e733e96f11cd.sql
-- ============================================================================

-- Add is_default column to agents table
ALTER TABLE agents 
ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Mark existing agents as default if they match a default_agent by agent_type_id
UPDATE agents a
SET is_default = true
WHERE EXISTS (
  SELECT 1 FROM default_agents da
  WHERE da.agent_type_id = a.agent_type_id
);

-- Update the seeding function to set is_default = true for new default agents
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default
  )
  SELECT 
    NEW.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    NEW.created_by,
    true
  FROM public.default_agents da
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = NEW.id 
    AND a.agent_type_id = da.agent_type_id
  );
  RETURN NEW;
END;
$function$;

-- Update the copy function to set is_default = true
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(
  p_default_agent_id uuid, 
  p_company_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_role text; 
  v_company uuid; 
  v_type uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  SELECT agent_type_id INTO v_type 
  FROM public.default_agents 
  WHERE id = p_default_agent_id;

  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default
  )
  SELECT 
    p_company_id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    auth.uid(),
    true
  FROM public.default_agents da
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE da.id = p_default_agent_id
    AND NOT EXISTS (
      SELECT 1 FROM public.agents a 
      WHERE a.company_id = p_company_id 
      AND a.agent_type_id = da.agent_type_id
    )
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
    AND a.agent_type_id = v_type 
    LIMIT 1;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Also update seed_default_agent_to_all_companies function
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_count int := 0; 
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;
  
  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default
  )
  SELECT 
    c.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    auth.uid(),
    true
  FROM public.companies c
  JOIN public.default_agents da ON da.id = p_default_agent_id
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agents a 
    WHERE a.company_id = c.id 
    AND a.agent_type_id = da.agent_type_id
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- Migration: 20251005215831_d8ea524e-4309-4707-8b28-6267e188591e.sql
-- ============================================================================

-- Update copy_default_agent_to_company to handle both default_agents and agents IDs
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_role text; 
  v_company uuid;
  v_type uuid;
  v_agent_name text;
  v_agent_description text;
  v_agent_config jsonb;
  v_agent_status agent_status;
BEGIN
  -- Authorization check: platform admin or company admin
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Try to find in default_agents table first
  SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
  INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
  FROM public.default_agents 
  WHERE id = p_default_agent_id;

  -- If not found in default_agents, try agents table (is_default = true)
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, configuration, status
    INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
    FROM public.agents 
    WHERE id = p_default_agent_id 
    AND is_default = true;
  END IF;

  -- If still not found, raise error
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  -- Check if agent type already exists for this company
  SELECT id INTO v_id 
  FROM public.agents a 
  WHERE a.company_id = p_company_id 
  AND a.agent_type_id = v_type 
  LIMIT 1;

  -- If agent type doesn't exist, create it
  IF v_id IS NULL THEN
    SELECT at.name INTO v_role
    FROM public.agent_types at
    WHERE at.id = v_type;

    INSERT INTO public.agents (
      company_id, 
      agent_type_id, 
      name, 
      role,
      description, 
      configuration, 
      status, 
      created_by,
      is_default
    )
    VALUES (
      p_company_id, 
      v_type, 
      v_agent_name, 
      v_role,
      v_agent_description, 
      v_agent_config, 
      v_agent_status, 
      auth.uid(),
      true
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- ============================================================================
-- Migration: 20251005221220_e85af2c1-4ea3-4f4b-be36-12b2dbb6d576.sql
-- ============================================================================

-- Fix is_platform_admin() to check both platform_admins table and profiles.role
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform-admin')
  INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Update seed_default_agent_to_all_companies to accept both default_agents and agents IDs
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_type uuid;
  v_name text;
  v_desc text;
  v_config jsonb;
  v_status agent_status := 'active';
  v_role text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Try default_agents first
  SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
    INTO v_type, v_name, v_desc, v_config, v_status
  FROM public.default_agents
  WHERE id = p_default_agent_id;

  -- Fallback: allow agents.id where is_default = true
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, configuration, status
      INTO v_type, v_name, v_desc, v_config, v_status
    FROM public.agents
    WHERE id = p_default_agent_id AND is_default = true;
  END IF;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  SELECT name INTO v_role FROM public.agent_types WHERE id = v_type;

  INSERT INTO public.agents (
    company_id,
    agent_type_id,
    name,
    role,
    description,
    configuration,
    status,
    created_by,
    is_default
  )
  SELECT
    c.id,
    v_type,
    v_name,
    v_role,
    v_desc,
    v_config,
    v_status,
    auth.uid(),
    true
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.company_id = c.id
      AND a.agent_type_id = v_type
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- Migration: 20251005222139_6236cced-4a93-4955-83b0-e2883d8a0158.sql
-- ============================================================================

-- Update copy_default_agent_to_company to prioritize agents table first
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_role text; 
  v_company uuid;
  v_type uuid;
  v_agent_name text;
  v_agent_description text;
  v_agent_config jsonb;
  v_agent_status agent_status;
BEGIN
  -- Authorization check: platform admin or company admin
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Try to find in agents table first (where is_default = true)
  SELECT agent_type_id, name, description, configuration, status
  INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
  FROM public.agents 
  WHERE id = p_default_agent_id 
  AND is_default = true;

  -- If not found in agents, try default_agents table
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
    INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
    FROM public.default_agents 
    WHERE id = p_default_agent_id;
  END IF;

  -- If still not found, raise error
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  -- Check if agent type already exists for this company
  SELECT id INTO v_id 
  FROM public.agents a 
  WHERE a.company_id = p_company_id 
  AND a.agent_type_id = v_type 
  LIMIT 1;

  -- If agent type doesn't exist, create it
  IF v_id IS NULL THEN
    SELECT at.name INTO v_role
    FROM public.agent_types at
    WHERE at.id = v_type;

    INSERT INTO public.agents (
      company_id, 
      agent_type_id, 
      name, 
      role,
      description, 
      configuration, 
      status, 
      created_by,
      is_default
    )
    VALUES (
      p_company_id, 
      v_type, 
      v_agent_name, 
      v_role,
      v_agent_description, 
      v_agent_config, 
      v_agent_status, 
      auth.uid(),
      true
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies to prioritize agents table first
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_type uuid;
  v_name text;
  v_desc text;
  v_config jsonb;
  v_status agent_status := 'active';
  v_role text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Try agents table first (where is_default = true)
  SELECT agent_type_id, name, description, configuration, status
    INTO v_type, v_name, v_desc, v_config, v_status
  FROM public.agents
  WHERE id = p_default_agent_id AND is_default = true;

  -- Fallback: try default_agents table
  IF v_type IS NULL THEN
    SELECT agent_type_id, name, description, config, COALESCE(status::agent_status, 'active'::agent_status)
      INTO v_type, v_name, v_desc, v_config, v_status
    FROM public.default_agents
    WHERE id = p_default_agent_id;
  END IF;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  SELECT name INTO v_role FROM public.agent_types WHERE id = v_type;

  INSERT INTO public.agents (
    company_id,
    agent_type_id,
    name,
    role,
    description,
    configuration,
    status,
    created_by,
    is_default
  )
  SELECT
    c.id,
    v_type,
    v_name,
    v_role,
    v_desc,
    v_config,
    v_status,
    auth.uid(),
    true
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.company_id = c.id
      AND a.agent_type_id = v_type
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- Migration: 20251005222845_792e4373-7cfc-4d9e-906b-31db96d6b26e.sql
-- ============================================================================

-- Update copy_default_agent_to_company to only use agents table
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_role text; 
  v_company uuid;
  v_type uuid;
  v_agent_name text;
  v_agent_description text;
  v_agent_config jsonb;
  v_agent_status agent_status;
BEGIN
  -- Authorization check: platform admin or company admin
  IF NOT public.is_platform_admin() THEN
    SELECT role, company_id INTO v_role, v_company 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF v_role <> 'admin' OR v_company <> p_company_id THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Fetch from agents table where is_default = true
  SELECT agent_type_id, name, description, configuration, status
  INTO v_type, v_agent_name, v_agent_description, v_agent_config, v_agent_status
  FROM public.agents 
  WHERE id = p_default_agent_id 
  AND is_default = true;

  -- If not found, raise error
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  -- Check if agent type already exists for this company
  SELECT id INTO v_id 
  FROM public.agents a 
  WHERE a.company_id = p_company_id 
  AND a.agent_type_id = v_type 
  LIMIT 1;

  -- If agent type doesn't exist, create it
  IF v_id IS NULL THEN
    SELECT at.name INTO v_role
    FROM public.agent_types at
    WHERE at.id = v_type;

    INSERT INTO public.agents (
      company_id, 
      agent_type_id, 
      name, 
      role,
      description, 
      configuration, 
      status, 
      created_by,
      is_default
    )
    VALUES (
      p_company_id, 
      v_type, 
      v_agent_name, 
      v_role,
      v_agent_description, 
      v_agent_config, 
      v_agent_status, 
      auth.uid(),
      false
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies to only use agents table
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_type uuid;
  v_name text;
  v_desc text;
  v_config jsonb;
  v_status agent_status := 'active';
  v_role text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Fetch from agents table where is_default = true
  SELECT agent_type_id, name, description, configuration, status
  INTO v_type, v_name, v_desc, v_config, v_status
  FROM public.agents
  WHERE id = p_default_agent_id AND is_default = true;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'default agent not found';
  END IF;

  SELECT name INTO v_role FROM public.agent_types WHERE id = v_type;

  INSERT INTO public.agents (
    company_id,
    agent_type_id,
    name,
    role,
    description,
    configuration,
    status,
    created_by,
    is_default
  )
  SELECT
    c.id,
    v_type,
    v_name,
    v_role,
    v_desc,
    v_config,
    v_status,
    auth.uid(),
    true
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.agents a
    WHERE a.company_id = c.id
      AND a.agent_type_id = v_type
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- Migration: 20251006113533_fix_seed_default_agents_trigger.sql
-- ============================================================================

-- Fix seed_default_agents_for_company to use auth.uid() instead of NEW.created_by
-- This resolves the error: record "new" has no field "created_by"
-- The companies table doesn't have a created_by column, so we use auth.uid() instead

CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default
  )
  SELECT 
    NEW.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    COALESCE(da.status::agent_status, 'active'::agent_status), 
    auth.uid(),  -- Changed from NEW.created_by to auth.uid()
    true
  FROM public.default_agents da
  JOIN public.agent_types at ON at.id = da.agent_type_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.company_id = NEW.id 
    AND a.agent_type_id = da.agent_type_id
  );
  RETURN NEW;
END;
$function$;



-- ============================================================================
-- Migration: 20251006140000_use_agents_table_for_seeding.sql
-- ============================================================================

-- Migrate company agent seeding to use template agents from agents table
-- Template agents are stored in agents table with is_default = TRUE and company_id IS NULL
-- This migration updates the trigger and functions to clone from agents table instead of default_agents

-- Step 1: Update seed_default_agents_for_company() to use agents table
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.agents (
    company_id, 
    agent_type_id, 
    name, 
    role,
    description, 
    configuration, 
    status, 
    created_by,
    is_default,
    system_instructions
  )
  SELECT 
    NEW.id,  -- New company's ID
    template.agent_type_id, 
    template.name, 
    template.role,
    template.description, 
    template.configuration, 
    template.status, 
    auth.uid(),
    false,  -- Cloned agents are NOT default, only templates are
    template.system_instructions  -- Copy system instructions from template
  FROM public.agents template
  WHERE template.is_default = TRUE 
    AND template.company_id IS NULL  -- Template agents
    AND NOT EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.company_id = NEW.id 
      AND a.agent_type_id = template.agent_type_id
    );
  RETURN NEW;
END;
$function$;

-- Step 2: Update copy_default_agent_to_company() to prioritize agents table
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(
  p_default_agent_id uuid, 
  p_company_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_template RECORD;
BEGIN
  -- Authorization check
  IF NOT public.is_platform_admin() THEN
    -- Check if user is company admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Get template agent (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents 
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback to default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, 
      description, configuration, status, created_by, is_default
    )
    SELECT 
      p_company_id, da.agent_type_id, da.name, at.name,
      da.description, da.config, 
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(), false  -- Cloned agents are NOT default
    FROM public.default_agents da
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE da.id = p_default_agent_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agents a 
        WHERE a.company_id = p_company_id 
        AND a.agent_type_id = da.agent_type_id
      )
    RETURNING id INTO v_id;
    
    -- Return existing if already exists
    IF v_id IS NULL THEN
      SELECT a.id INTO v_id 
      FROM public.agents a 
      JOIN public.default_agents da ON da.agent_type_id = a.agent_type_id
      WHERE da.id = p_default_agent_id
        AND a.company_id = p_company_id 
      LIMIT 1;
    END IF;
  ELSE
    -- Check if agent type already exists for this company
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
      AND a.agent_type_id = v_template.agent_type_id 
    LIMIT 1;
    
    -- Clone from agents table if doesn't exist
    IF v_id IS NULL THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, v_template.agent_type_id, v_template.name, v_template.role,
        v_template.description, v_template.configuration, v_template.status,
        auth.uid(), false, v_template.system_instructions  -- Cloned agents are NOT default, copy system_instructions
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Step 3: Update seed_default_agent_to_all_companies() to prioritize agents table
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(
  p_default_agent_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_template RECORD;
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;

  -- Try to get template from agents table (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback: try default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default
    )
    SELECT
      c.id,
      da.agent_type_id,
      da.name,
      at.name as role,
      da.description,
      da.config as configuration,
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(),
      false  -- Cloned agents are NOT default
    FROM public.companies c
    JOIN public.default_agents da ON da.id = p_default_agent_id
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = da.agent_type_id
    );
  ELSE
    -- Clone template from agents table to all companies
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role,
      description, configuration, status, created_by, is_default, system_instructions
    )
    SELECT
      c.id,
      v_template.agent_type_id,
      v_template.name,
      v_template.role,
      v_template.description,
      v_template.configuration,
      v_template.status,
      auth.uid(),
      false,  -- Cloned agents are NOT default, only templates are
      v_template.system_instructions  -- Copy system instructions from template
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = v_template.agent_type_id
    );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;



-- ============================================================================
-- Migration: 20251006155343_52588c37-263c-43b9-9345-103afe0ec505.sql
-- ============================================================================

-- Remove duplicate platform admin policy on agents table
-- Keep only the policy using is_platform_admin() without parameters

DROP POLICY IF EXISTS "Platform admins can manage agents" ON public.agents;

-- The "platform admin full access agents" policy already exists and uses is_platform_admin()
-- This is the correct policy to keep as it uses the no-parameter version of the function

-- ============================================================================
-- Migration: 20251008073722_5c1ef482-de5c-47d8-815e-e3aaa50cbbf3.sql
-- ============================================================================

-- Update seed_default_agents_for_company to include nickname
CREATE OR REPLACE FUNCTION public.seed_default_agents_for_company(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  template RECORD;
  v_provision_result json;
BEGIN
  FOR template IN 
    SELECT * FROM public.agents 
    WHERE is_default = TRUE AND company_id IS NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE company_id = p_company_id 
      AND agent_type_id = template.agent_type_id
    ) THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role, nickname,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, template.agent_type_id, template.name, template.role, template.nickname,
        template.description, template.configuration, template.status,
        auth.uid(), false, template.system_instructions
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$function$;

-- Update copy_default_agent_to_company to include nickname
CREATE OR REPLACE FUNCTION public.copy_default_agent_to_company(p_default_agent_id uuid, p_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  v_id uuid; 
  v_template RECORD;
  v_provision_result json;
BEGIN
  -- Authorization check
  IF NOT public.is_platform_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin' 
      AND company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  END IF;

  -- Get template agent (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents 
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback to default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default
    )
    SELECT 
      p_company_id, da.agent_type_id, da.name, at.name, da.name as nickname,
      da.description, da.config, 
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(), false
    FROM public.default_agents da
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE da.id = p_default_agent_id
      AND NOT EXISTS (
        SELECT 1 FROM public.agents a 
        WHERE a.company_id = p_company_id 
        AND a.agent_type_id = da.agent_type_id
      )
    RETURNING id INTO v_id;
    
    IF v_id IS NULL THEN
      SELECT a.id INTO v_id 
      FROM public.agents a 
      JOIN public.default_agents da ON da.agent_type_id = a.agent_type_id
      WHERE da.id = p_default_agent_id
        AND a.company_id = p_company_id 
      LIMIT 1;
    END IF;
  ELSE
    -- Check if agent type already exists for this company
    SELECT id INTO v_id 
    FROM public.agents a 
    WHERE a.company_id = p_company_id 
      AND a.agent_type_id = v_template.agent_type_id 
    LIMIT 1;
    
    -- Clone from agents table if doesn't exist
    IF v_id IS NULL THEN
      INSERT INTO public.agents (
        company_id, agent_type_id, name, role, nickname,
        description, configuration, status, created_by, is_default, system_instructions
      )
      VALUES (
        p_company_id, v_template.agent_type_id, v_template.name, v_template.role, v_template.nickname,
        v_template.description, v_template.configuration, v_template.status,
        auth.uid(), false, v_template.system_instructions
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;
  
  -- Provision OpenAI resources for the cloned agent if it was just created
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.agents 
      WHERE id = v_id 
      AND assistant_id IS NOT NULL 
      AND vector_store_id IS NOT NULL
    ) THEN
      SELECT name, description INTO v_template
      FROM public.agents 
      WHERE id = v_id;
      
      v_provision_result := public.provision_agent_openai_resources(
        v_id,
        p_company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI resources for agent % in company %: %', 
          v_template.name, p_company_id, v_provision_result->>'error';
      END IF;
    END IF;
  END IF;
  
  RETURN v_id;
END;
$function$;

-- Update seed_default_agent_to_all_companies to include nickname
CREATE OR REPLACE FUNCTION public.seed_default_agent_to_all_companies(p_default_agent_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_template RECORD;
  v_company RECORD;
  v_provision_result json;
BEGIN
  IF NOT public.is_platform_admin() THEN 
    RAISE EXCEPTION 'not authorized'; 
  END IF;

  -- Try to get template from agents table (is_default = TRUE, company_id IS NULL)
  SELECT * INTO v_template
  FROM public.agents
  WHERE id = p_default_agent_id 
    AND is_default = TRUE
    AND company_id IS NULL;

  -- Fallback: try default_agents table for backward compatibility
  IF v_template IS NULL THEN
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default
    )
    SELECT
      c.id,
      da.agent_type_id,
      da.name,
      at.name as role,
      da.name as nickname,
      da.description,
      da.config as configuration,
      COALESCE(da.status::agent_status, 'active'::agent_status),
      auth.uid(),
      false
    FROM public.companies c
    JOIN public.default_agents da ON da.id = p_default_agent_id
    JOIN public.agent_types at ON at.id = da.agent_type_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = da.agent_type_id
    );
  ELSE
    -- Clone template from agents table to all companies
    INSERT INTO public.agents (
      company_id, agent_type_id, name, role, nickname,
      description, configuration, status, created_by, is_default, system_instructions
    )
    SELECT
      c.id,
      v_template.agent_type_id,
      v_template.name,
      v_template.role,
      v_template.nickname,
      v_template.description,
      v_template.configuration,
      v_template.status,
      auth.uid(),
      false,
      v_template.system_instructions
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.company_id = c.id
        AND a.agent_type_id = v_template.agent_type_id
    );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Provision OpenAI resources for all newly created agents
  IF v_count > 0 THEN
    IF v_template IS NULL THEN
      SELECT da.name, da.description INTO v_template
      FROM public.default_agents da
      WHERE da.id = p_default_agent_id;
    END IF;
    
    FOR v_company IN (
      SELECT DISTINCT a.id as agent_id, a.company_id, c.name as company_name
      FROM public.agents a
      JOIN public.companies c ON c.id = a.company_id
      WHERE a.created_by = auth.uid()
        AND a.created_at > NOW() - INTERVAL '1 minute'
        AND (a.assistant_id IS NULL OR a.vector_store_id IS NULL)
    ) LOOP
      v_provision_result := public.provision_agent_openai_resources(
        v_company.agent_id,
        v_company.company_id,
        v_template.name,
        v_template.description
      );
      
      IF NOT (v_provision_result->>'success')::boolean THEN
        RAISE WARNING 'Failed to provision OpenAI for agent in company %: %', 
          v_company.company_name, v_provision_result->>'error';
      END IF;
    END LOOP;
  END IF;
  
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- Migration: 20251008074111_6d325edc-14de-4618-8ee8-56d5aa0e03ad.sql
-- ============================================================================

-- Update all existing agents to set nickname based on name
-- Converts name to lowercase and replaces spaces with underscores
UPDATE public.agents
SET nickname = LOWER(REPLACE(name, ' ', '_'))
WHERE nickname IS NULL OR nickname = '';

-- Also update where nickname doesn't match the expected format
UPDATE public.agents
SET nickname = LOWER(REPLACE(name, ' ', '_'))
WHERE nickname != LOWER(REPLACE(name, ' ', '_'));

-- ============================================================================
-- Migration: 20251015154854_25387385-b736-4bb6-a0a6-3c98c6701658.sql
-- ============================================================================

-- Add purchased_seats column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS purchased_seats INTEGER DEFAULT 1;

-- ============================================================================
-- Migration: 20251016115427_033a7403-f0b6-45cc-bff6-6269316a835f.sql
-- ============================================================================

-- Drop all existing policies on team_invitations
DROP POLICY IF EXISTS "Users can view invitations they sent or company invitations" ON team_invitations;
DROP POLICY IF EXISTS "Admin and moderator users can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users can update invitations they sent or company invitations" ON team_invitations;
DROP POLICY IF EXISTS "Users can delete invitations they sent" ON team_invitations;
DROP POLICY IF EXISTS "Company admins and platform admins can delete invitations" ON team_invitations;

-- Create comprehensive policies with platform admin support

-- SELECT: Platform admins can view all, company members can view their company's invitations
CREATE POLICY "Platform admins and company members can view invitations"
ON team_invitations
FOR SELECT
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- INSERT: Platform admins and company admins can create invitations
CREATE POLICY "Platform admins and company admins can create invitations"
ON team_invitations
FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- UPDATE: Platform admins and authorized users can update invitations
CREATE POLICY "Platform admins and authorized users can update invitations"
ON team_invitations
FOR UPDATE
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role IN ('admin', 'moderator')
  ))
);

-- DELETE: Platform admins and company admins can delete invitations
CREATE POLICY "Platform admins and company admins can delete invitations"
ON team_invitations
FOR DELETE
USING (
  is_platform_admin(auth.uid()) OR
  is_company_admin(auth.uid(), company_id) OR
  invited_by = auth.uid() OR
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND company_id = team_invitations.company_id
    AND role = 'admin'
  ))
);

-- ============================================================================
-- Migration: 20251029124054_add_status_to_company_os.sql
-- ============================================================================

-- Add status column to company_os table to track generation progress
-- This supports the two-step process: extract text -> generate CompanyOS

-- Create status enum type
CREATE TYPE company_os_status AS ENUM ('draft', 'extracting', 'generating', 'completed', 'failed');

-- Add status column with default 'completed' for backward compatibility
ALTER TABLE public.company_os 
ADD COLUMN IF NOT EXISTS status company_os_status DEFAULT 'completed' NOT NULL;

-- Make os_data nullable to allow draft records during text extraction
ALTER TABLE public.company_os 
ALTER COLUMN os_data DROP NOT NULL;

-- Create index for status-based queries
CREATE INDEX IF NOT EXISTS idx_company_os_status ON public.company_os(status);

-- Add comment for the new column
COMMENT ON COLUMN public.company_os.status IS 'Current status of CompanyOS generation: draft (text extracted), extracting (in progress), generating (AI processing), completed (ready), failed (error occurred)';






-- ============================================================================
-- Migration: 20251102000000_add_chain_mention_to_mention_type.sql
-- ============================================================================

-- Add 'chain_mention' to the mention_type constraint
-- This allows chained agent responses to be stored correctly

-- Drop the existing constraint
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_mention_type_check;

-- Recreate the constraint with 'chain_mention' included
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_mention_type_check 
CHECK (mention_type IN ('direct_mention', 'direct_conversation', 'chain_mention'));

-- Update the column comment to reflect the new value
COMMENT ON COLUMN public.chat_messages.mention_type IS 'Differentiates between agent mentions in channels (direct_mention), direct conversations with agents (direct_conversation), and chained agent responses (chain_mention)';



-- ============================================================================
-- Migration: 20251105000000_cleanup_channel_tables.sql
-- ============================================================================

-- Clean up channel-related tables by dropping unused scheduling and onboarding fields
-- These columns are no longer used by the simplified collaboration experience

ALTER TABLE IF EXISTS public.channels
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS provisioning_status,
  DROP COLUMN IF EXISTS consultation_status,
  DROP COLUMN IF EXISTS meeting_scheduled_at,
  DROP COLUMN IF EXISTS appointment_status,
  DROP COLUMN IF EXISTS provisioning_completed_at;

ALTER TABLE IF EXISTS public.channel_members
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS meeting_scheduled_at,
  DROP COLUMN IF EXISTS invitation_status,
  DROP COLUMN IF EXISTS appointment_notes;

ALTER TABLE IF EXISTS public.assistant_membership
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS scheduling_status,
  DROP COLUMN IF EXISTS provisioning_status,
  DROP COLUMN IF EXISTS onboarding_step;


-- ============================================================================
-- Migration: 20251106000000_fix_onboarding_schema.sql
-- ============================================================================

-- Ensure onboarding schema consistency for onboarding workspace creation

-- Create onboarding_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'onboarding_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed');
  END IF;
END $$;

-- Make sure profile name columns exist for workspace onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Create onboarding_sessions table if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'onboarding_sessions'
  ) THEN
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
  END IF;
END $$;

-- Align onboarding_sessions columns if the table already existed without the latest schema
ALTER TABLE public.onboarding_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status onboarding_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  ADD COLUMN IF NOT EXISTS completed_steps INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Ensure updated_at stays in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_onboarding_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_onboarding_sessions_updated_at
      BEFORE UPDATE ON public.onboarding_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Make sure RLS and policies exist
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can view their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can view their onboarding session" ON public.onboarding_sessions
      FOR SELECT USING (user_id = auth.uid() OR company_id = public.get_user_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can update their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can update their onboarding session" ON public.onboarding_sessions
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- Helpful indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_company_id ON public.onboarding_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);


-- ============================================================================
-- Migration: 20251109000001_repair_onboarding_schema.sql
-- ============================================================================

-- Defensive repair for onboarding schema issues reported in production

-- Ensure onboarding_status enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'onboarding_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed');
  END IF;
END $$;

-- Guarantee profile name columns exist for onboarding flows
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Create onboarding_sessions table if it has not been provisioned
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
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

-- Align columns in case the table exists but is missing expected fields
ALTER TABLE public.onboarding_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status onboarding_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  ADD COLUMN IF NOT EXISTS completed_steps INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Keep updated_at in sync when rows change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_onboarding_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_onboarding_sessions_updated_at
      BEFORE UPDATE ON public.onboarding_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Ensure RLS and policies are present
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can view their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can view their onboarding session" ON public.onboarding_sessions
      FOR SELECT USING (user_id = auth.uid() OR company_id = public.get_user_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can update their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can update their onboarding session" ON public.onboarding_sessions
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- Helpful indexes to keep lookups fast
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_company_id ON public.onboarding_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);

-- Force PostgREST to refresh its schema cache so new tables/columns are available immediately
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Migration: 20251117000001_add_consultant_role.sql
-- ============================================================================

-- Add consultant role to app_role enum
-- This allows consultants to manage multiple client workspaces

DO $$ BEGIN
  -- Check if the type exists before trying to modify it
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    -- Add 'consultant' to the enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'app_role'::regtype
      AND enumlabel = 'consultant'
    ) THEN
      ALTER TYPE app_role ADD VALUE 'consultant' AFTER 'platform-admin';
    END IF;
  END IF;
END $$;

-- Update RLS policies to allow consultants to manage their assigned workspaces
-- This will be expanded in subsequent migrations once consultant_workspaces table exists

COMMENT ON TYPE app_role IS 'User roles: platform-admin (super admin), consultant (manages multiple client workspaces), admin (company admin), moderator, user';


-- ============================================================================
-- Migration: 20251117000002_create_consultant_workspaces.sql
-- ============================================================================

-- Create consultant_workspaces table
-- Enables many-to-many relationship between consultants and client companies
-- A consultant can manage multiple client workspaces

CREATE TABLE IF NOT EXISTS consultant_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure a consultant can only be assigned once per company
  UNIQUE(consultant_id, company_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consultant_workspaces_consultant_id ON consultant_workspaces(consultant_id);
CREATE INDEX IF NOT EXISTS idx_consultant_workspaces_company_id ON consultant_workspaces(company_id);

-- Enable RLS
ALTER TABLE consultant_workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Consultants can view their own workspace assignments
CREATE POLICY "Consultants can view their own workspaces"
  ON consultant_workspaces
  FOR SELECT
  USING (
    auth.uid() = consultant_id
    OR
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Platform admins can create workspace assignments
CREATE POLICY "Platform admins can create workspace assignments"
  ON consultant_workspaces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform-admin', 'consultant')
    )
  );

-- Consultants and platform admins can update their workspace assignments
CREATE POLICY "Consultants can update their workspaces"
  ON consultant_workspaces
  FOR UPDATE
  USING (
    auth.uid() = consultant_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Platform admins can delete workspace assignments
CREATE POLICY "Platform admins can delete workspace assignments"
  ON consultant_workspaces
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultant_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultant_workspaces_updated_at
  BEFORE UPDATE ON consultant_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_consultant_workspaces_updated_at();

COMMENT ON TABLE consultant_workspaces IS 'Maps consultants to the client companies they manage. Enables multi-tenancy for consultants.';


-- ============================================================================
-- Migration: 20251117000003_create_agent_documents.sql
-- ============================================================================

-- Create agent_documents table
-- Stores agent-specific documentation with vector embeddings for RAG
-- Unlike the 'documents' table, these are tied to specific agents

CREATE TABLE IF NOT EXISTS agent_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Document metadata
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'pdf', 'text', 'url', 'html')),

  -- Source tracking
  source_url TEXT,
  source_file_name TEXT,
  source_file_path TEXT,  -- Supabase storage path if uploaded

  -- Vector embedding for semantic search
  embedding vector(1536),  -- OpenAI text-embedding-ada-002 or text-embedding-3-small

  -- Chunking support (for large documents)
  chunk_index INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  word_count INTEGER,
  estimated_read_time INTEGER,  -- in minutes
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Access control
  created_by UUID REFERENCES profiles(id),
  uploaded_by UUID REFERENCES profiles(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_id ON agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_company_id ON agent_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_content_type ON agent_documents(content_type);
CREATE INDEX IF NOT EXISTS idx_agent_documents_tags ON agent_documents USING GIN(tags);

-- Vector similarity search index (IVFFlat)
-- Note: Adjust 'lists' parameter based on dataset size (rule of thumb: rows / 1000)
CREATE INDEX IF NOT EXISTS idx_agent_documents_embedding
  ON agent_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Enable RLS
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view agent documents from their own company
CREATE POLICY "Users can view agent documents from their company"
  ON agent_documents
  FOR SELECT
  USING (
    -- User belongs to this company
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can create agent documents
CREATE POLICY "Consultants can create agent documents"
  ON agent_documents
  FOR INSERT
  WITH CHECK (
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can create anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can update agent documents
CREATE POLICY "Consultants can update agent documents"
  ON agent_documents
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can delete agent documents
CREATE POLICY "Consultants can delete agent documents"
  ON agent_documents
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_updated_at
  BEFORE UPDATE ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documents_updated_at();

-- Trigger to update word count and estimated read time
CREATE OR REPLACE FUNCTION update_agent_documents_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate word count (rough estimate: split on whitespace)
  NEW.word_count = array_length(regexp_split_to_array(NEW.content, '\s+'), 1);

  -- Estimated read time: 200 words per minute
  NEW.estimated_read_time = GREATEST(1, CEIL(NEW.word_count::numeric / 200));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_metadata
  BEFORE INSERT OR UPDATE OF content ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documents_metadata();

COMMENT ON TABLE agent_documents IS 'Agent-specific documentation with vector embeddings for RAG retrieval. Each document is tied to a specific agent.';
COMMENT ON COLUMN agent_documents.embedding IS 'Vector embedding (1536 dimensions) for semantic search using OpenAI text-embedding-ada-002';
COMMENT ON COLUMN agent_documents.chunk_index IS 'For large documents split into chunks: 0-based index of this chunk';
COMMENT ON COLUMN agent_documents.total_chunks IS 'Total number of chunks for this document';


-- ============================================================================
-- Migration: 20251117000004_create_context_retrievals.sql
-- ============================================================================

-- Create context_retrievals table
-- Logs all context retrieval operations for analytics, debugging, and quality monitoring
-- Tracks what context was retrieved for each user query

CREATE TABLE IF NOT EXISTS context_retrievals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Query information
  original_query TEXT NOT NULL,
  expanded_queries TEXT[],

  -- Retrieved context (stored as JSONB for flexibility)
  -- Each entry: {id, content, source, score, metadata}
  company_os_chunks JSONB DEFAULT '[]'::jsonb,
  agent_doc_chunks JSONB DEFAULT '[]'::jsonb,
  playbook_chunks JSONB DEFAULT '[]'::jsonb,
  shared_doc_chunks JSONB DEFAULT '[]'::jsonb,
  keyword_matches JSONB DEFAULT '[]'::jsonb,
  structured_data JSONB DEFAULT '{}'::jsonb,

  -- Performance metrics (in milliseconds)
  retrieval_time_ms INTEGER,
  rerank_time_ms INTEGER,
  total_time_ms INTEGER,

  -- Quality metrics
  context_confidence_score NUMERIC(3,2) CHECK (context_confidence_score >= 0 AND context_confidence_score <= 1),
  sources_used INTEGER DEFAULT 0,
  chunks_retrieved INTEGER DEFAULT 0,
  chunks_used_in_prompt INTEGER DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_context_retrievals_agent_id ON context_retrievals(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_company_id ON context_retrievals(company_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_conversation_id ON context_retrievals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_created_at ON context_retrievals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_confidence_score ON context_retrievals(context_confidence_score);

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_context_retrievals_company_os_chunks ON context_retrievals USING GIN(company_os_chunks);
CREATE INDEX IF NOT EXISTS idx_context_retrievals_agent_doc_chunks ON context_retrievals USING GIN(agent_doc_chunks);

-- Enable RLS
ALTER TABLE context_retrievals ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view context retrievals from their own company
CREATE POLICY "Users can view context retrievals from their company"
  ON context_retrievals
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- System can insert context retrievals (no user restriction)
CREATE POLICY "System can insert context retrievals"
  ON context_retrievals
  FOR INSERT
  WITH CHECK (true);

-- Only platform admins can delete old retrieval logs
CREATE POLICY "Platform admins can delete context retrievals"
  ON context_retrievals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Function to calculate context confidence score
-- Based on average relevance scores of retrieved chunks
CREATE OR REPLACE FUNCTION calculate_context_confidence(
  company_os_chunks JSONB,
  agent_doc_chunks JSONB,
  playbook_chunks JSONB,
  shared_doc_chunks JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  all_scores NUMERIC[];
  avg_score NUMERIC;
BEGIN
  -- Extract all scores from chunks
  SELECT ARRAY(
    SELECT (value->>'score')::numeric
    FROM (
      SELECT jsonb_array_elements(company_os_chunks) AS value
      UNION ALL
      SELECT jsonb_array_elements(agent_doc_chunks)
      UNION ALL
      SELECT jsonb_array_elements(playbook_chunks)
      UNION ALL
      SELECT jsonb_array_elements(shared_doc_chunks)
    ) AS all_chunks
    WHERE value->>'score' IS NOT NULL
  ) INTO all_scores;

  -- Calculate average
  IF array_length(all_scores, 1) IS NULL OR array_length(all_scores, 1) = 0 THEN
    RETURN 0.0;
  END IF;

  SELECT AVG(score) INTO avg_score FROM unnest(all_scores) AS score;

  RETURN ROUND(avg_score, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate metrics before insert
CREATE OR REPLACE FUNCTION update_context_retrieval_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate confidence score if not provided
  IF NEW.context_confidence_score IS NULL THEN
    NEW.context_confidence_score = calculate_context_confidence(
      NEW.company_os_chunks,
      NEW.agent_doc_chunks,
      NEW.playbook_chunks,
      NEW.shared_doc_chunks
    );
  END IF;

  -- Count sources used
  NEW.sources_used = 0;
  IF jsonb_array_length(NEW.company_os_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.agent_doc_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.playbook_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.shared_doc_chunks) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;
  IF jsonb_array_length(NEW.keyword_matches) > 0 THEN
    NEW.sources_used = NEW.sources_used + 1;
  END IF;

  -- Count total chunks retrieved
  NEW.chunks_retrieved = (
    COALESCE(jsonb_array_length(NEW.company_os_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.agent_doc_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.playbook_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.shared_doc_chunks), 0) +
    COALESCE(jsonb_array_length(NEW.keyword_matches), 0)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_retrieval_metrics
  BEFORE INSERT ON context_retrievals
  FOR EACH ROW
  EXECUTE FUNCTION update_context_retrieval_metrics();

-- Create a view for easy analytics
CREATE OR REPLACE VIEW context_retrieval_analytics AS
SELECT
  agent_id,
  company_id,
  DATE(created_at) AS retrieval_date,
  COUNT(*) AS total_retrievals,
  AVG(context_confidence_score) AS avg_confidence,
  AVG(total_time_ms) AS avg_total_time_ms,
  AVG(chunks_retrieved) AS avg_chunks_retrieved,
  AVG(sources_used) AS avg_sources_used,
  COUNT(*) FILTER (WHERE context_confidence_score < 0.7) AS low_confidence_count,
  COUNT(*) FILTER (WHERE total_time_ms > 2000) AS slow_retrievals
FROM context_retrievals
GROUP BY agent_id, company_id, DATE(created_at);

COMMENT ON TABLE context_retrievals IS 'Logs all context retrieval operations for debugging and quality monitoring';
COMMENT ON COLUMN context_retrievals.context_confidence_score IS 'Average relevance score of retrieved chunks (0-1)';
COMMENT ON COLUMN context_retrievals.chunks_used_in_prompt IS 'Number of chunks actually included in the final prompt (after reranking)';


-- ============================================================================
-- Migration: 20251117000005_create_query_expansion_cache.sql
-- ============================================================================

-- Create query_expansion_cache table
-- Caches query expansions to avoid repeated LLM calls for common queries
-- Significant performance and cost optimization

CREATE TABLE IF NOT EXISTS query_expansion_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_query TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE,  -- MD5 hash for fast lookup
  expanded_queries TEXT[] NOT NULL,
  expansion_model TEXT DEFAULT 'gpt-3.5-turbo',

  -- Usage tracking
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_query_hash ON query_expansion_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_expires_at ON query_expansion_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_last_used_at ON query_expansion_cache(last_used_at DESC);

-- Enable RLS (but allow all reads for performance)
ALTER TABLE query_expansion_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can read from cache (it's generic query expansions)
CREATE POLICY "Anyone can read query expansion cache"
  ON query_expansion_cache
  FOR SELECT
  USING (true);

-- System can insert new cache entries
CREATE POLICY "System can insert cache entries"
  ON query_expansion_cache
  FOR INSERT
  WITH CHECK (true);

-- System can update cache entries (for hit_count, last_used_at)
CREATE POLICY "System can update cache entries"
  ON query_expansion_cache
  FOR UPDATE
  USING (true);

-- Platform admins can delete cache entries
CREATE POLICY "Platform admins can delete cache entries"
  ON query_expansion_cache
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Function to generate query hash
CREATE OR REPLACE FUNCTION generate_query_hash(query TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalize query: lowercase, trim, collapse whitespace
  RETURN md5(lower(regexp_replace(trim(query), '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get or create cached query expansion
CREATE OR REPLACE FUNCTION get_cached_query_expansion(query TEXT)
RETURNS TEXT[] AS $$
DECLARE
  hash TEXT;
  cached_expansions TEXT[];
BEGIN
  hash := generate_query_hash(query);

  -- Try to get from cache
  SELECT expanded_queries INTO cached_expansions
  FROM query_expansion_cache
  WHERE query_hash = hash
    AND expires_at > NOW();

  -- Update hit count and last_used_at if found
  IF cached_expansions IS NOT NULL THEN
    UPDATE query_expansion_cache
    SET
      hit_count = hit_count + 1,
      last_used_at = NOW(),
      expires_at = NOW() + INTERVAL '30 days'  -- Extend expiration
    WHERE query_hash = hash;
  END IF;

  RETURN cached_expansions;
END;
$$ LANGUAGE plpgsql;

-- Function to cache query expansion
CREATE OR REPLACE FUNCTION cache_query_expansion(
  query TEXT,
  expansions TEXT[],
  model TEXT DEFAULT 'gpt-3.5-turbo'
)
RETURNS UUID AS $$
DECLARE
  hash TEXT;
  cache_id UUID;
BEGIN
  hash := generate_query_hash(query);

  -- Insert or update
  INSERT INTO query_expansion_cache (
    original_query,
    query_hash,
    expanded_queries,
    expansion_model,
    hit_count,
    last_used_at,
    expires_at
  )
  VALUES (
    query,
    hash,
    expansions,
    model,
    0,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (query_hash) DO UPDATE
  SET
    expanded_queries = EXCLUDED.expanded_queries,
    expansion_model = EXCLUDED.expansion_model,
    last_used_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days'
  RETURNING id INTO cache_id;

  RETURN cache_id;
END;
$$ LANGUAGE plpgsql;

-- Scheduled cleanup of expired cache entries (run daily)
-- Note: This requires pg_cron extension, or can be called manually
CREATE OR REPLACE FUNCTION cleanup_expired_query_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM query_expansion_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Also cleanup entries not used in 90 days (even if not expired)
CREATE OR REPLACE FUNCTION cleanup_stale_query_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM query_expansion_cache
  WHERE last_used_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE query_expansion_cache IS 'Caches query expansions to avoid repeated LLM API calls';
COMMENT ON COLUMN query_expansion_cache.query_hash IS 'MD5 hash of normalized query for fast lookup';
COMMENT ON COLUMN query_expansion_cache.hit_count IS 'Number of times this cache entry has been used';
COMMENT ON FUNCTION get_cached_query_expansion IS 'Retrieves cached query expansion if exists and not expired, updates hit count';
COMMENT ON FUNCTION cache_query_expansion IS 'Stores query expansion in cache with 30-day expiration';


-- ============================================================================
-- Migration: 20251117000006_create_context_injection_config.sql
-- ============================================================================

-- Create context_injection_config table
-- Per-agent configuration for context retrieval and prompt assembly
-- Allows consultants to fine-tune how context is retrieved and used

CREATE TABLE IF NOT EXISTS context_injection_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Enable/disable each context tier
  enable_company_os BOOLEAN DEFAULT TRUE,
  enable_agent_docs BOOLEAN DEFAULT TRUE,
  enable_playbooks BOOLEAN DEFAULT TRUE,
  enable_shared_docs BOOLEAN DEFAULT TRUE,
  enable_keyword_search BOOLEAN DEFAULT TRUE,
  enable_structured_data BOOLEAN DEFAULT FALSE,

  -- Retrieval parameters
  max_chunks_per_source INTEGER DEFAULT 3 CHECK (max_chunks_per_source >= 1 AND max_chunks_per_source <= 10),
  total_max_chunks INTEGER DEFAULT 10 CHECK (total_max_chunks >= 1 AND total_max_chunks <= 20),
  similarity_threshold NUMERIC(3,2) DEFAULT 0.70 CHECK (similarity_threshold >= 0 AND similarity_threshold <= 1),

  -- Query expansion settings
  enable_query_expansion BOOLEAN DEFAULT TRUE,
  max_expanded_queries INTEGER DEFAULT 5 CHECK (max_expanded_queries >= 1 AND max_expanded_queries <= 10),

  -- Reranking settings
  enable_reranking BOOLEAN DEFAULT TRUE,
  rerank_model TEXT DEFAULT 'cohere-rerank-v3',
  rerank_top_n INTEGER DEFAULT 8 CHECK (rerank_top_n >= 1 AND rerank_top_n <= 20),

  -- Prompt assembly settings
  prompt_template TEXT,  -- Custom Jinja2-style template (optional)
  include_citations BOOLEAN DEFAULT TRUE,
  citation_format TEXT DEFAULT 'footnote' CHECK (citation_format IN ('footnote', 'inline', 'none')),
  max_context_tokens INTEGER DEFAULT 8000 CHECK (max_context_tokens >= 1000 AND max_context_tokens <= 32000),

  -- Advanced settings
  company_os_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (company_os_weight >= 0 AND company_os_weight <= 2),
  agent_docs_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (agent_docs_weight >= 0 AND agent_docs_weight <= 2),
  playbooks_weight NUMERIC(3,2) DEFAULT 0.8 CHECK (playbooks_weight >= 0 AND playbooks_weight <= 2),
  shared_docs_weight NUMERIC(3,2) DEFAULT 0.8 CHECK (shared_docs_weight >= 0 AND shared_docs_weight <= 2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_context_injection_config_agent_id ON context_injection_config(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_injection_config_company_id ON context_injection_config(company_id);

-- Enable RLS
ALTER TABLE context_injection_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view configs from their own company
CREATE POLICY "Users can view context configs from their company"
  ON context_injection_config
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can create configs
CREATE POLICY "Consultants can create context configs"
  ON context_injection_config
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can update configs
CREATE POLICY "Consultants can update context configs"
  ON context_injection_config
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can delete configs
CREATE POLICY "Consultants can delete context configs"
  ON context_injection_config
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_context_injection_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_injection_config_updated_at
  BEFORE UPDATE ON context_injection_config
  FOR EACH ROW
  EXECUTE FUNCTION update_context_injection_config_updated_at();

-- Function to create default config when agent is created
CREATE OR REPLACE FUNCTION create_default_context_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default context config for new agent
  INSERT INTO context_injection_config (
    agent_id,
    company_id,
    enable_company_os,
    enable_agent_docs,
    enable_playbooks,
    enable_shared_docs,
    enable_keyword_search,
    enable_structured_data,
    max_chunks_per_source,
    total_max_chunks,
    similarity_threshold,
    enable_query_expansion,
    max_expanded_queries,
    enable_reranking,
    rerank_model,
    rerank_top_n,
    include_citations,
    citation_format,
    max_context_tokens
  )
  VALUES (
    NEW.id,
    NEW.company_id,
    TRUE,   -- enable_company_os
    TRUE,   -- enable_agent_docs
    TRUE,   -- enable_playbooks
    TRUE,   -- enable_shared_docs
    TRUE,   -- enable_keyword_search
    FALSE,  -- enable_structured_data
    3,      -- max_chunks_per_source
    10,     -- total_max_chunks
    0.70,   -- similarity_threshold
    TRUE,   -- enable_query_expansion
    5,      -- max_expanded_queries
    TRUE,   -- enable_reranking
    'cohere-rerank-v3',  -- rerank_model
    8,      -- rerank_top_n
    TRUE,   -- include_citations
    'footnote',  -- citation_format
    8000    -- max_context_tokens
  )
  ON CONFLICT (agent_id) DO NOTHING;  -- Avoid duplicate if already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to agents table
CREATE TRIGGER agent_create_context_config
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION create_default_context_config();

-- Helper function to get config with fallback to defaults
CREATE OR REPLACE FUNCTION get_context_config(p_agent_id UUID)
RETURNS context_injection_config AS $$
DECLARE
  config context_injection_config;
BEGIN
  SELECT * INTO config
  FROM context_injection_config
  WHERE agent_id = p_agent_id;

  -- If no config exists, return default
  IF NOT FOUND THEN
    SELECT
      gen_random_uuid() AS id,
      p_agent_id AS agent_id,
      NULL::UUID AS company_id,
      TRUE AS enable_company_os,
      TRUE AS enable_agent_docs,
      TRUE AS enable_playbooks,
      TRUE AS enable_shared_docs,
      TRUE AS enable_keyword_search,
      FALSE AS enable_structured_data,
      3 AS max_chunks_per_source,
      10 AS total_max_chunks,
      0.70 AS similarity_threshold,
      TRUE AS enable_query_expansion,
      5 AS max_expanded_queries,
      TRUE AS enable_reranking,
      'cohere-rerank-v3' AS rerank_model,
      8 AS rerank_top_n,
      NULL AS prompt_template,
      TRUE AS include_citations,
      'footnote' AS citation_format,
      8000 AS max_context_tokens,
      1.0 AS company_os_weight,
      1.0 AS agent_docs_weight,
      0.8 AS playbooks_weight,
      0.8 AS shared_docs_weight,
      NOW() AS created_at,
      NOW() AS updated_at
    INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE context_injection_config IS 'Per-agent configuration for context retrieval and prompt assembly';
COMMENT ON COLUMN context_injection_config.similarity_threshold IS 'Minimum cosine similarity score (0-1) to include a chunk';
COMMENT ON COLUMN context_injection_config.company_os_weight IS 'Weight multiplier for CompanyOS chunks during reranking (0-2)';
COMMENT ON COLUMN context_injection_config.prompt_template IS 'Custom Jinja2-style template for prompt assembly (optional, falls back to default)';
COMMENT ON FUNCTION create_default_context_config IS 'Automatically creates default context config when new agent is created';
COMMENT ON FUNCTION get_context_config IS 'Retrieves context config for agent, returns defaults if not found';


-- ============================================================================
-- Migration: 20251117000007_modify_companies_table.sql
-- ============================================================================

-- Modify companies table to support consultant management
-- Add fields for consultant ownership and client permissions

-- Add new columns
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS is_client_workspace BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS workspace_type TEXT DEFAULT 'client' CHECK (
    workspace_type IN ('client', 'consultant', 'internal')
  ),
  ADD COLUMN IF NOT EXISTS client_permissions JSONB DEFAULT '{
    "can_create_agents": false,
    "can_edit_company_os": false,
    "can_upload_documents": false,
    "can_create_playbooks": false,
    "can_contribute_to_playbooks": true,
    "can_invite_users": false,
    "can_view_analytics": false,
    "can_edit_profile": true,
    "can_view_agents": true,
    "can_chat_with_agents": true
  }'::jsonb;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_companies_managed_by ON companies(managed_by);
CREATE INDEX IF NOT EXISTS idx_companies_workspace_type ON companies(workspace_type);
CREATE INDEX IF NOT EXISTS idx_companies_is_client_workspace ON companies(is_client_workspace);

-- Update RLS policies to account for consultant management

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

-- Users can view their own company OR companies they manage as consultant
CREATE POLICY "Users can view their company or managed companies"
  ON companies
  FOR SELECT
  USING (
    -- User belongs to this company
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- User manages this company as consultant
    id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- User is platform admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Consultants and platform admins can create companies
CREATE POLICY "Consultants can create companies"
  ON companies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('platform-admin', 'consultant')
    )
  );

-- Consultants can update companies they manage
CREATE POLICY "Consultants can update managed companies"
  ON companies
  FOR UPDATE
  USING (
    -- User manages this company
    id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
    OR
    -- Company admin (limited updates only)
    (
      id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
      AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- Only platform admins can delete companies
CREATE POLICY "Platform admins can delete companies"
  ON companies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Helper function to check if user has permission in a company
CREATE OR REPLACE FUNCTION user_has_company_permission(
  p_company_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  permissions JSONB;
  user_role TEXT;
BEGIN
  -- Get company permissions
  SELECT client_permissions INTO permissions
  FROM companies
  WHERE id = p_company_id;

  -- Get user role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  AND company_id = p_company_id;

  -- Platform admins and consultants have all permissions
  IF user_role IN ('platform-admin', 'consultant') THEN
    RETURN TRUE;
  END IF;

  -- Check if user is consultant managing this company
  IF EXISTS (
    SELECT 1 FROM consultant_workspaces
    WHERE consultant_id = auth.uid()
    AND company_id = p_company_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission
  RETURN COALESCE((permissions->p_permission)::boolean, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update client permissions (only consultants/admins)
CREATE OR REPLACE FUNCTION update_client_permissions(
  p_company_id UUID,
  p_permissions JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is consultant or platform admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (
      role IN ('platform-admin', 'consultant')
      OR
      id IN (SELECT consultant_id FROM consultant_workspaces WHERE company_id = p_company_id)
    )
  ) THEN
    RAISE EXCEPTION 'Only consultants and platform admins can update client permissions';
  END IF;

  UPDATE companies
  SET client_permissions = p_permissions,
      updated_at = NOW()
  WHERE id = p_company_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN companies.managed_by IS 'The consultant who manages this client workspace';
COMMENT ON COLUMN companies.is_client_workspace IS 'Whether this is a client workspace (true) or consultant/internal workspace (false)';
COMMENT ON COLUMN companies.workspace_type IS 'Type of workspace: client, consultant, or internal';
COMMENT ON COLUMN companies.client_permissions IS 'JSON object defining what permissions client users have in this workspace';
COMMENT ON FUNCTION user_has_company_permission IS 'Checks if current user has a specific permission in a company';
COMMENT ON FUNCTION update_client_permissions IS 'Updates client permissions for a company (consultant/admin only)';


-- ============================================================================
-- Migration: 20251117000008_modify_agents_table.sql
-- ============================================================================

-- Modify agents table to support context injection features

-- Add new columns
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS documentation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_config_id UUID REFERENCES context_injection_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_update_context BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_context_update TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agents_context_config_id ON agents(context_config_id);
CREATE INDEX IF NOT EXISTS idx_agents_documentation_count ON agents(documentation_count);

-- Update RLS policies for agents to account for consultant management

-- Drop old policies if they conflict
DROP POLICY IF EXISTS "Users can view agents from their company" ON agents;
DROP POLICY IF EXISTS "Admins can create agents" ON agents;
DROP POLICY IF EXISTS "Admins can update agents" ON agents;
DROP POLICY IF EXISTS "Admins can delete agents" ON agents;

-- Users can view agents from their own company or companies they manage
CREATE POLICY "Users can view agents from their company or managed companies"
  ON agents
  FOR SELECT
  USING (
    -- User belongs to this company
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- User manages this company as consultant
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
    OR
    -- Default agents (templates) are visible to consultants and platform admins
    (
      is_default = TRUE
      AND company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('platform-admin', 'consultant')
      )
    )
  );

-- Only consultants and platform admins can create agents
CREATE POLICY "Consultants can create agents"
  ON agents
  FOR INSERT
  WITH CHECK (
    -- Consultant manages this company
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    -- Platform admin can create anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
    OR
    -- Special case: creating default agents (templates)
    (
      is_default = TRUE
      AND company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform-admin'
      )
    )
  );

-- Only consultants and platform admins can update agents
CREATE POLICY "Consultants can update agents"
  ON agents
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Only consultants and platform admins can delete agents
CREATE POLICY "Consultants can delete agents"
  ON agents
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM consultant_workspaces WHERE consultant_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Trigger to update documentation count when agent_documents change
CREATE OR REPLACE FUNCTION update_agent_documentation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agents
    SET documentation_count = documentation_count + 1,
        last_context_update = NOW()
    WHERE id = NEW.agent_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agents
    SET documentation_count = GREATEST(0, documentation_count - 1),
        last_context_update = NOW()
    WHERE id = OLD.agent_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_documents_count_insert
  AFTER INSERT ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documentation_count();

CREATE TRIGGER agent_documents_count_delete
  AFTER DELETE ON agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_documentation_count();

-- Function to sync context_config_id when context config is created
CREATE OR REPLACE FUNCTION sync_agent_context_config_id()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agents
  SET context_config_id = NEW.id,
      last_context_update = NOW()
  WHERE id = NEW.agent_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER context_config_sync_to_agent
  AFTER INSERT ON context_injection_config
  FOR EACH ROW
  EXECUTE FUNCTION sync_agent_context_config_id();

-- Function to recalculate documentation count (for data consistency)
CREATE OR REPLACE FUNCTION recalculate_agent_documentation_count(p_agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count
  FROM agent_documents
  WHERE agent_id = p_agent_id;

  UPDATE agents
  SET documentation_count = doc_count,
      last_context_update = NOW()
  WHERE id = p_agent_id;

  RETURN doc_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN agents.documentation_count IS 'Number of agent_documents associated with this agent';
COMMENT ON COLUMN agents.context_config_id IS 'FK to context_injection_config for this agent';
COMMENT ON COLUMN agents.auto_update_context IS 'Whether to automatically update context when documents are added/removed';
COMMENT ON COLUMN agents.last_context_update IS 'Last time agent context (docs or config) was updated';
COMMENT ON FUNCTION recalculate_agent_documentation_count IS 'Recalculates and updates the documentation_count for an agent';


-- ============================================================================
-- Migration: 20251117000009_modify_onboarding_sessions.sql
-- ============================================================================

-- Modify onboarding_sessions table to support consultant-managed onboarding

-- Add new columns
ALTER TABLE onboarding_sessions
  ADD COLUMN IF NOT EXISTS invited_by_consultant UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS workspace_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS skip_company_os_creation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS skip_agent_creation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS invitation_token TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_invited_by_consultant ON onboarding_sessions(invited_by_consultant);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_workspace_ready ON onboarding_sessions(workspace_ready);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_invitation_token ON onboarding_sessions(invitation_token);

-- Function to check if workspace is ready for client access
CREATE OR REPLACE FUNCTION check_workspace_ready(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_company_os BOOLEAN;
  has_agents BOOLEAN;
BEGIN
  -- Check if CompanyOS exists and is completed
  SELECT EXISTS (
    SELECT 1 FROM company_os
    WHERE company_id = p_company_id
    AND status = 'completed'
  ) INTO has_company_os;

  -- Check if at least one active agent exists
  SELECT EXISTS (
    SELECT 1 FROM agents
    WHERE company_id = p_company_id
    AND status = 'active'
  ) INTO has_agents;

  RETURN has_company_os AND has_agents;
END;
$$ LANGUAGE plpgsql;

-- Function to mark workspace as ready
CREATE OR REPLACE FUNCTION mark_workspace_ready(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_ready BOOLEAN;
BEGIN
  is_ready := check_workspace_ready(p_company_id);

  -- Update all onboarding sessions for this company
  UPDATE onboarding_sessions
  SET workspace_ready = is_ready,
      updated_at = NOW()
  WHERE company_id = p_company_id;

  RETURN is_ready;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update workspace_ready when CompanyOS is completed
CREATE OR REPLACE FUNCTION auto_mark_workspace_ready()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM mark_workspace_ready(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_os_completed_mark_workspace_ready
  AFTER INSERT OR UPDATE OF status ON company_os
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_workspace_ready();

-- Trigger to auto-update workspace_ready when agent is created
CREATE OR REPLACE FUNCTION auto_mark_workspace_ready_on_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Check when active agent is created
  IF NEW.status = 'active' THEN
    PERFORM mark_workspace_ready(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_created_mark_workspace_ready
  AFTER INSERT OR UPDATE OF status ON agents
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_workspace_ready_on_agent();

COMMENT ON COLUMN onboarding_sessions.invited_by_consultant IS 'The consultant who created this workspace and sent the invitation';
COMMENT ON COLUMN onboarding_sessions.workspace_ready IS 'Whether the workspace is ready for client use (has CompanyOS and active agents)';
COMMENT ON COLUMN onboarding_sessions.skip_company_os_creation IS 'Whether to skip CompanyOS creation in onboarding (consultant will do it)';
COMMENT ON COLUMN onboarding_sessions.skip_agent_creation IS 'Whether to skip agent creation in onboarding (consultant will do it)';
COMMENT ON FUNCTION check_workspace_ready IS 'Checks if a workspace has CompanyOS and active agents (ready for client)';
COMMENT ON FUNCTION mark_workspace_ready IS 'Updates workspace_ready flag for all onboarding sessions of a company';


-- ============================================================================
-- Migration: 20251117000010_create_vector_search_functions.sql
-- ============================================================================

-- Create SQL functions for vector search and context retrieval
-- These functions are used by the context injection system

-- Function: Match agent documents by vector similarity
CREATE OR REPLACE FUNCTION match_agent_documents(
  query_embedding vector(1536),
  match_agent_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  content TEXT,
  title TEXT,
  source_file_name TEXT,
  similarity FLOAT,
  chunk_index INT,
  total_chunks INT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    agent_documents.id,
    agent_documents.agent_id,
    agent_documents.content,
    agent_documents.title,
    agent_documents.source_file_name,
    1 - (agent_documents.embedding <=> query_embedding) AS similarity,
    agent_documents.chunk_index,
    agent_documents.total_chunks,
    agent_documents.metadata,
    agent_documents.created_at
  FROM agent_documents
  WHERE agent_documents.agent_id = match_agent_id
    AND agent_documents.embedding IS NOT NULL
    AND 1 - (agent_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY agent_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Match shared documents (company-wide, not agent-specific)
CREATE OR REPLACE FUNCTION match_shared_documents(
  query_embedding vector(1536),
  match_company_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.company_id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    JSONB_BUILD_OBJECT(
      'document_archive_id', documents.document_archive_id,
      'agent_id', documents.agent_id
    ) AS metadata,
    documents.created_at
  FROM documents
  WHERE documents.company_id = match_company_id
    AND documents.agent_id IS NULL  -- Only shared docs (not agent-specific)
    AND documents.embedding IS NOT NULL
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Search playbooks by full-text search
CREATE OR REPLACE FUNCTION search_playbooks(
  search_query TEXT,
  match_company_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  section_order INT,
  tags TEXT[],
  relevance FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    playbook_sections.id,
    playbook_sections.title,
    playbook_sections.content,
    playbook_sections.section_order,
    playbook_sections.tags,
    ts_rank(
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM playbook_sections
  WHERE playbook_sections.company_id = match_company_id
    AND playbook_sections.status = 'complete'
    AND (
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, ''))
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

-- Function: Keyword search across all text sources
CREATE OR REPLACE FUNCTION keyword_search_all_sources(
  search_query TEXT,
  match_company_id UUID,
  match_agent_id UUID DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source TEXT,  -- 'agent_docs', 'shared_docs', 'playbooks'
  content TEXT,
  title TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Agent documents
  SELECT
    agent_documents.id,
    'agent_docs'::TEXT AS source,
    agent_documents.content,
    agent_documents.title,
    ts_rank(
      to_tsvector('english', COALESCE(agent_documents.title, '') || ' ' || COALESCE(agent_documents.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM agent_documents
  WHERE agent_documents.company_id = match_company_id
    AND (match_agent_id IS NULL OR agent_documents.agent_id = match_agent_id)
    AND to_tsvector('english', COALESCE(agent_documents.title, '') || ' ' || COALESCE(agent_documents.content, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Shared documents
  SELECT
    documents.id,
    'shared_docs'::TEXT AS source,
    documents.content,
    COALESCE(
      (SELECT document_archives.file_name FROM document_archives WHERE document_archives.id = documents.document_archive_id),
      'Untitled'
    ) AS title,
    ts_rank(
      to_tsvector('english', documents.content),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM documents
  WHERE documents.company_id = match_company_id
    AND documents.agent_id IS NULL
    AND to_tsvector('english', documents.content) @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Playbooks
  SELECT
    playbook_sections.id,
    'playbooks'::TEXT AS source,
    playbook_sections.content,
    playbook_sections.title,
    ts_rank(
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM playbook_sections
  WHERE playbook_sections.company_id = match_company_id
    AND playbook_sections.status = 'complete'
    AND to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, ''))
        @@ plainto_tsquery('english', search_query)

  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

-- Function: Create client workspace (used by consultants)
CREATE OR REPLACE FUNCTION create_client_workspace(
  p_company_name TEXT,
  p_company_domain TEXT DEFAULT NULL,
  p_consultant_id UUID DEFAULT NULL,
  p_client_permissions JSONB DEFAULT NULL,
  p_primary_contact_email TEXT DEFAULT NULL,
  p_primary_contact_first_name TEXT DEFAULT NULL,
  p_primary_contact_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  company_id UUID,
  invitation_id UUID,
  invitation_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id UUID;
  new_invitation_id UUID;
  new_invitation_token TEXT;
  default_permissions JSONB;
BEGIN
  -- Verify caller is consultant or platform admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = COALESCE(p_consultant_id, auth.uid())
    AND role IN ('consultant', 'platform-admin')
  ) THEN
    RAISE EXCEPTION 'Only consultants and platform admins can create client workspaces';
  END IF;

  -- Default permissions if not provided
  default_permissions := COALESCE(p_client_permissions, '{
    "can_create_agents": false,
    "can_edit_company_os": false,
    "can_upload_documents": false,
    "can_create_playbooks": false,
    "can_contribute_to_playbooks": true,
    "can_invite_users": false,
    "can_view_analytics": false,
    "can_edit_profile": true,
    "can_view_agents": true,
    "can_chat_with_agents": true
  }'::jsonb);

  -- Create company
  INSERT INTO companies (
    name,
    domain,
    managed_by,
    is_client_workspace,
    workspace_type,
    client_permissions,
    created_by
  )
  VALUES (
    p_company_name,
    p_company_domain,
    COALESCE(p_consultant_id, auth.uid()),
    TRUE,
    'client',
    default_permissions,
    COALESCE(p_consultant_id, auth.uid())
  )
  RETURNING id INTO new_company_id;

  -- Create consultant_workspaces mapping
  INSERT INTO consultant_workspaces (
    consultant_id,
    company_id,
    role
  )
  VALUES (
    COALESCE(p_consultant_id, auth.uid()),
    new_company_id,
    'owner'
  );

  -- Create CompanyOS placeholder
  INSERT INTO company_os (
    company_id,
    os_data,
    status,
    generated_by
  )
  VALUES (
    new_company_id,
    '{}'::jsonb,
    'draft',
    COALESCE(p_consultant_id, auth.uid())
  );

  -- If primary contact provided, create invitation
  IF p_primary_contact_email IS NOT NULL THEN
    new_invitation_token := encode(gen_random_bytes(32), 'base64');

    INSERT INTO team_invitations (
      company_id,
      email,
      first_name,
      last_name,
      role,
      invitation_token,
      status,
      invited_by,
      expires_at
    )
    VALUES (
      new_company_id,
      p_primary_contact_email,
      COALESCE(p_primary_contact_first_name, ''),
      COALESCE(p_primary_contact_last_name, ''),
      'admin',
      new_invitation_token,
      'pending',
      COALESCE(p_consultant_id, auth.uid()),
      NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO new_invitation_id;
  END IF;

  RETURN QUERY SELECT new_company_id, new_invitation_id, new_invitation_token;
END;
$$;

COMMENT ON FUNCTION match_agent_documents IS 'Vector similarity search for agent-specific documents';
COMMENT ON FUNCTION match_shared_documents IS 'Vector similarity search for company-wide shared documents';
COMMENT ON FUNCTION search_playbooks IS 'Full-text search for playbook sections';
COMMENT ON FUNCTION keyword_search_all_sources IS 'Keyword search across all text sources (agent docs, shared docs, playbooks)';
COMMENT ON FUNCTION create_client_workspace IS 'Creates a new client workspace with company, consultant mapping, and optional invitation';


