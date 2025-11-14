import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionPlan } from '@/types/stripe';
import { jsonToStringArray } from '@/types/stripe';

export interface UpgradeOptions {
  planId: string;
  planName: string;
  seatLimit: number | null;
  priceMonthly: number;
  features: string[];
}

/**
 * Calculate the recommended number of seats for upgrade
 */
export function calculateRequiredSeats(current: number, needed: number): number {
  // Add buffer of 25% to avoid frequent upgrades
  const buffer = Math.ceil(needed * 0.25);
  return Math.max(needed + buffer, current + 1);
}

/**
 * Get available upgrade options for a company
 */
export async function getUpgradeOptions(currentPlanId: string): Promise<UpgradeOptions[]> {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Filter out plans with lower seat limits than current
    const currentPlan = plans?.find(p => p.id === currentPlanId);
    const currentSeatLimit = currentPlan?.seat_limit || 0;

    return (plans || [])
      .filter(plan => {
        // Include unlimited plans (seat_limit is null)
        if (plan.seat_limit === null) return true;
        // Include plans with higher seat limits
        return plan.seat_limit > currentSeatLimit;
      })
      .map(plan => ({
        planId: plan.id,
        planName: plan.name,
        seatLimit: plan.seat_limit,
        priceMonthly: plan.price_monthly,
        features: jsonToStringArray(plan.features),
      }));
  } catch (error) {
    console.error('Error fetching upgrade options:', error);
    return [];
  }
}

/**
 * Trigger Stripe checkout for subscription upgrade
 */
export async function triggerUpgradeFlow(
  planId: string, 
  companyId: string, 
  seats: number
): Promise<{ sessionId: string; url: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        seats,
        successUrl: `${window.location.origin}/billing?upgrade=success`,
        cancelUrl: `${window.location.origin}/team-management`,
      }
    });

    if (error) throw error;

    return {
      sessionId: data.sessionId,
      url: data.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

/**
 * Get current company subscription details
 */
export async function getCompanySubscription(companyId: string) {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        subscription_current_period_start,
        subscription_current_period_end,
        plan_id,
        purchased_seats,
        subscription_plans (*)
      `)
      .eq('id', companyId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching company subscription:', error);
    return null;
  }
}

/**
 * Check if company can upgrade to a specific plan
 */
export function canUpgradeToPlan(
  currentPlan: SubscriptionPlan | null,
  targetPlan: SubscriptionPlan
): boolean {
  if (!currentPlan) return true;
  
  // Can upgrade if target plan has higher seat limit or is unlimited
  if (targetPlan.seat_limit === null) return true;
  if (currentPlan.seat_limit === null) return false;
  
  return targetPlan.seat_limit > currentPlan.seat_limit;
}

/**
 * Get upgrade recommendation based on current usage
 */
export function getUpgradeRecommendation(
  currentSeats: number,
  usedSeats: number,
  currentPlan: SubscriptionPlan | null
): { recommended: boolean; reason: string } {
  const usagePercentage = currentSeats > 0 ? (usedSeats / currentSeats) * 100 : 0;
  
  if (usagePercentage >= 100) {
    return {
      recommended: true,
      reason: 'You have reached your seat limit and cannot invite more team members.'
    };
  }
  
  if (usagePercentage >= 90) {
    return {
      recommended: true,
      reason: 'You are approaching your seat limit. Consider upgrading to avoid restrictions.'
    };
  }
  
  if (usagePercentage >= 75) {
    return {
      recommended: false,
      reason: 'You have good seat availability, but monitor your usage as you grow.'
    };
  }
  
  return {
    recommended: false,
    reason: 'You have plenty of seats available for your current team size.'
  };
}
