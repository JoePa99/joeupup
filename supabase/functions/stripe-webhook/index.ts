import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!stripeKey || !webhookSecret) {
      throw new Error('Stripe keys are not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No stripe signature found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get raw body for signature verification
    const body = await req.text();

    // Verify webhook signature (async for Deno/Edge Runtime)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received webhook event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabase);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice, supabase);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice, supabase);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle checkout session completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
  const companyId = session.metadata?.company_id;
  const planId = session.metadata?.plan_id;
  const seats = parseInt(session.metadata?.seats || '1');

  if (!companyId || !planId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  console.log(`Checkout completed for company ${companyId}, plan ${planId}, seats ${seats}`);

  // Update company with subscription details including seat count
  await supabase
    .from('companies')
    .update({
      stripe_subscription_id: session.subscription,
      subscription_status: 'active',
      plan_id: planId,
      purchased_seats: seats,
    })
    .eq('id', companyId);

  // Get plan details to initialize usage
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('message_limit_per_seat')
    .eq('id', planId)
    .single();

  if (plan) {
    // Initialize usage for all existing company users
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId);

    if (users && users.length > 0) {
      const messageLimit = plan.message_limit_per_seat;
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      console.log(`Initializing usage for ${users.length} users with ${messageLimit} messages each`);

      // Create usage records for all users
      const usageRecords = users.map(user => ({
        user_id: user.id,
        company_id: companyId,
        messages_used: 0,
        messages_limit: messageLimit,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      }));

      const { error: usageError } = await supabase
        .from('user_usage')
        .upsert(usageRecords, { onConflict: 'user_id,period_start' });

      if (usageError) {
        console.error('Error initializing usage:', usageError);
      } else {
        console.log(`Successfully initialized usage for ${users.length} users`);
      }
    }
  }
}

// Handle subscription created/updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
  const companyId = subscription.metadata?.company_id;
  const planId = subscription.metadata?.plan_id;
  const seats = parseInt(subscription.metadata?.seats || '1');

  if (!companyId) {
    console.error('Missing company_id in subscription metadata');
    return;
  }

  console.log(`Subscription updated for company ${companyId}: ${subscription.status}`);

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('message_limit_per_seat')
    .eq('id', planId)
    .single();

  // Update company subscription status including seat count
  const updateData: any = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    plan_id: planId,
    purchased_seats: seats,
  };

  // Only add period dates if they exist
  if (subscription.current_period_start) {
    updateData.subscription_current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  }
  if (subscription.current_period_end) {
    updateData.subscription_current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }

  await supabase
    .from('companies')
    .update(updateData)
    .eq('id', companyId);

  console.log(`Updated company ${companyId} with ${seats} seats, plan ${planId}, status ${subscription.status}`);

  // Initialize or update usage records for all company users
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId);

    console.log(`Found ${users?.length || 0} users in company ${companyId}`);

    if (users && users.length > 0 && plan) {
      const messageLimit = plan.message_limit_per_seat;
      const periodStart = subscription.current_period_start 
        ? new Date(subscription.current_period_start * 1000) 
        : new Date();
      const periodEnd = subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000) 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      console.log(`Setting up usage: ${messageLimit} messages per user, period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

      // Upsert usage records for all users (update if exists, insert if not)
      const usageRecords = users.map(user => ({
        user_id: user.id,
        company_id: companyId,
        messages_used: 0,
        messages_limit: messageLimit,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      }));

      const { error: usageError } = await supabase
        .from('user_usage')
        .upsert(usageRecords, { 
          onConflict: 'user_id,period_start',
          ignoreDuplicates: false 
        });

      if (usageError) {
        console.error('Error initializing/updating usage:', usageError);
      } else {
        console.log(`Successfully initialized/updated usage for ${users.length} users with ${messageLimit} messages each`);
      }
    }
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
  const companyId = subscription.metadata?.company_id;

  if (!companyId) {
    console.error('Missing company_id in subscription metadata');
    return;
  }

  console.log(`Subscription deleted for company ${companyId}`);

  // Update company status
  await supabase
    .from('companies')
    .update({
      subscription_status: 'canceled',
    })
    .eq('id', companyId);
}

// Handle successful payment
async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return;
  }

  console.log(`Payment succeeded for subscription ${subscriptionId}`);

  // Update company status if it was past_due
  await supabase
    .from('companies')
    .update({
      subscription_status: 'active',
    })
    .eq('stripe_subscription_id', subscriptionId)
    .eq('subscription_status', 'past_due');
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice, supabase: any) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return;
  }

  console.log(`Payment failed for subscription ${subscriptionId}`);

  // Update company status to past_due
  await supabase
    .from('companies')
    .update({
      subscription_status: 'past_due',
    })
    .eq('stripe_subscription_id', subscriptionId);

  // TODO: Send notification email to admin
}

