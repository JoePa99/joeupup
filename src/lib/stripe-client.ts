// Stripe client utilities

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';
import type { CheckoutSessionRequest, CustomerPortalRequest } from '@/types/stripe';

let stripePromise: Promise<Stripe | null>;

/**
 * Get Stripe.js instance
 */
export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error('Stripe publishable key not configured');
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

/**
 * Create a checkout session and redirect to Stripe
 */
export const createCheckoutSession = async (
  planId: string,
  seats: number,
  successUrl?: string,
  cancelUrl?: string
): Promise<void> => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Default URLs
    const baseUrl = window.location.origin;
    const defaultSuccessUrl = `${baseUrl}/onboarding?success=true`;
    const defaultCancelUrl = `${baseUrl}/onboarding?canceled=true`;

    // Call edge function to create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        seats,
        successUrl: successUrl || defaultSuccessUrl,
        cancelUrl: cancelUrl || defaultCancelUrl,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      
      // Try to extract the actual error message from the function response
      let errorMessage = 'Failed to create checkout session';
      
      // The Supabase client might have already parsed the body
      if (error.message) {
        errorMessage = error.message;
      }
      
      // Log full error for debugging
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      throw new Error(errorMessage);
    }

    if (!data?.url) {
      console.error('No checkout URL in response:', data);
      throw new Error('No checkout URL returned');
    }

    // Redirect to Stripe Checkout
    window.location.href = data.url;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Open Stripe Customer Portal
 */
export const openCustomerPortal = async (returnUrl?: string): Promise<void> => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    // Default return URL
    const baseUrl = window.location.origin;
    const defaultReturnUrl = `${baseUrl}/billing`;

    // Call edge function to create portal session
    const { data, error } = await supabase.functions.invoke('create-customer-portal', {
      body: {
        returnUrl: returnUrl || defaultReturnUrl,
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('No portal URL returned');
    }

    // Redirect to Stripe Customer Portal
    window.location.href = data.url;
  } catch (error) {
    console.error('Error opening customer portal:', error);
    throw error;
  }
};

/**
 * Format price in cents to display format
 */
export const formatPrice = (cents: number): string => {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
};

/**
 * Calculate total monthly cost
 */
export const calculateMonthlyCost = (pricePerSeat: number, seats: number): string => {
  const totalCents = pricePerSeat * seats;
  return formatPrice(totalCents);
};






