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






