import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Stripe key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client with the user's token for RLS checks
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { planId, seats, successUrl, cancelUrl } = await req.json();

    if (!planId || !seats || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: planId, seats, successUrl, cancelUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    console.log('Profile:', profile, 'Error:', profileError);

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found', details: profileError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin using user's auth context
    const { data: isPlatformAdmin, error: platformAdminError } = await supabaseUser
      .rpc('is_platform_admin');

    console.log('User role:', profile.role);
    console.log('Is platform admin:', isPlatformAdmin, 'Error:', platformAdminError);

    // Only company admins or platform admins can create subscriptions
    if (profile.role !== 'admin' && !isPlatformAdmin) {
      return new Response(
        JSON.stringify({ 
          error: 'Only company admins or platform admins can manage subscriptions',
          userRole: profile.role,
          isPlatformAdmin: isPlatformAdmin
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = profile.company_id;

    // Get subscription plan details using admin client
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check seat limit
    if (plan.seat_limit && seats > plan.seat_limit) {
      return new Response(
        JSON.stringify({ error: `Plan allows maximum of ${plan.seat_limit} seats` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer using admin client
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('stripe_customer_id, name')
      .eq('id', companyId)
      .single();

    let customerId = company?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer using fetch
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email || '',
          'metadata[company_id]': companyId,
          'metadata[user_id]': user.id,
          ...(company?.name ? { name: company.name } : {}),
        }),
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.text();
        throw new Error(`Failed to create Stripe customer: ${error}`);
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Update company with Stripe customer ID using admin client
      await supabaseAdmin
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId);
    }

    // Create Stripe checkout session using fetch
    const sessionParams = new URLSearchParams({
      customer: customerId,
      'payment_method_types[]': 'card',
      'line_items[0][price]': plan.stripe_price_id,
      'line_items[0][quantity]': seats.toString(),
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'metadata[company_id]': companyId,
      'metadata[user_id]': user.id,
      'metadata[plan_id]': planId,
      'metadata[seats]': seats.toString(),
      'subscription_data[metadata][company_id]': companyId,
      'subscription_data[metadata][plan_id]': planId,
      'subscription_data[metadata][seats]': seats.toString(),
    });

    const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: sessionParams,
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error('Stripe API error:', error);
      throw new Error(`Failed to create checkout session: ${error}`);
    }

    const session = await sessionResponse.json();

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
