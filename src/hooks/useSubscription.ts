import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SubscriptionPlan, CompanySubscription, SubscriptionStatus } from '@/types/stripe';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to fetch available subscription plans
 */
export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (fetchError) throw fetchError;

        setPlans((data || []) as SubscriptionPlan[]);
      } catch (err) {
        console.error('Error fetching subscription plans:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return {
    plans,
    isLoading,
    error,
  };
};

/**
 * Hook to fetch current company subscription details
 */
export const useCompanySubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get user's company
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get company subscription details
      const { data: companyData, error: companyError } = await supabase
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
        .eq('id', profile.company_id)
        .single();

      if (companyError) throw companyError;

      setSubscription({
        stripe_customer_id: companyData.stripe_customer_id,
        stripe_subscription_id: companyData.stripe_subscription_id,
        subscription_status: companyData.subscription_status as SubscriptionStatus,
        subscription_current_period_start: companyData.subscription_current_period_start,
        subscription_current_period_end: companyData.subscription_current_period_end,
        plan_id: companyData.plan_id,
        purchased_seats: companyData.purchased_seats,
      });

      if (companyData.subscription_plans) {
        setPlan(companyData.subscription_plans as any);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          // Refetch on changes
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    subscription,
    plan,
    isLoading,
    error,
    refetch: fetchSubscription,
  };
};

/**
 * Check if subscription is active
 */
export const useIsSubscriptionActive = () => {
  const { subscription, isLoading } = useCompanySubscription();

  const isActive = 
    subscription?.subscription_status === 'active' || 
    subscription?.subscription_status === 'trialing';

  return {
    isActive,
    isLoading,
    status: subscription?.subscription_status || 'inactive',
  };
};






