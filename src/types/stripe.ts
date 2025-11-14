// Stripe-related TypeScript types
import type { Json } from '@/integrations/supabase/types';

// Helper to safely convert Json to string[]
export function jsonToStringArray(json: Json | null | undefined): string[] {
  if (!json) return [];
  if (Array.isArray(json)) {
    return json.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export type SubscriptionStatus =
  | 'active' 
  | 'inactive' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number; // in cents
  message_limit_per_seat: number;
  seat_limit: number | null; // null means unlimited
  features: Json;
  stripe_price_id: string;
  stripe_product_id: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompanySubscription {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_current_period_start: string | null;
  subscription_current_period_end: string | null;
  plan_id: string | null;
  purchased_seats?: number | null;
}

export interface CheckoutSessionRequest {
  planId: string;
  seats: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface CustomerPortalRequest {
  returnUrl: string;
}

export interface CustomerPortalResponse {
  url: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}






