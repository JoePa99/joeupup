import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionPlan } from '@/types/stripe';

interface SeatValidationData {
  purchasedSeats: number;
  activeMembers: number;
  pendingInvitations: number;
  availableSeats: number;
  hasAvailableSeats: boolean;
  isLoading: boolean;
  canInvite: boolean;
  usagePercentage: number;
  isUnlimited: boolean;
  refetch: () => void;
}

export function useSeatValidation(): SeatValidationData {
  const { user } = useAuth();
  const [purchasedSeats, setPurchasedSeats] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchSeatData = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get user's company
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.company_id) {
        setIsLoading(false);
        return;
      }

      setCompanyId(profile.company_id);

      // Get company subscription details with seat information
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (companyError) throw companyError;

      // Get subscription plan details separately
      let planData = null;
      if (companyData.plan_id) {
        const { data: plan, error: planError } = await supabase
          .from('subscription_plans')
          .select('seat_limit, name')
          .eq('id', companyData.plan_id)
          .single();
        
        if (!planError) {
          planData = plan;
        }
      }

      // Get active team members count
      const { count: activeCount, error: activeError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id);

      if (activeError) throw activeError;

      // Get pending invitations count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Use seat_limit from subscription plan as the source of truth
      // If seat_limit is null, the plan has unlimited seats
      // Fallback to purchased_seats from companies table if plan doesn't exist
      const fallbackPurchasedSeats = (companyData as any).purchased_seats || 0;
      
      // Determine purchased seats and unlimited status based on plan
      let purchased = 0;
      let unlimited = false;
      
      if (planData) {
        // Plan exists - use seat_limit from plan
        if (planData.seat_limit === null) {
          // Null seat_limit means unlimited
          unlimited = true;
          purchased = 0; // Set to 0 to indicate unlimited
        } else {
          // Use the seat limit from the plan
          purchased = planData.seat_limit;
          unlimited = false;
        }
      } else {
        // No plan exists - fallback to purchased_seats from companies table
        purchased = fallbackPurchasedSeats;
        unlimited = false;
      }
      
      const active = activeCount || 0;
      const pending = pendingCount || 0;

      setPurchasedSeats(purchased);
      setActiveMembers(active);
      setPendingInvitations(pending);
      setIsUnlimited(unlimited);

    } catch (error) {
      console.error('Error fetching seat data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSeatData();
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!companyId) return;

    const profilesChannel = supabase
      .channel('seat-validation-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchSeatData();
        }
      )
      .subscribe();

    const invitationsChannel = supabase
      .channel('seat-validation-invitations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_invitations',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchSeatData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(invitationsChannel);
    };
  }, [companyId]);

  const totalUsed = activeMembers + pendingInvitations;
  const availableSeats = isUnlimited 
    ? Infinity 
    : Math.max(0, purchasedSeats - totalUsed);
  const hasAvailableSeats = isUnlimited || availableSeats > 0;
  const canInvite = hasAvailableSeats;
  const usagePercentage = isUnlimited || purchasedSeats === 0 
    ? 0 
    : Math.round((totalUsed / purchasedSeats) * 100);

  return {
    purchasedSeats,
    activeMembers,
    pendingInvitations,
    availableSeats,
    hasAvailableSeats,
    isLoading,
    canInvite,
    usagePercentage,
    isUnlimited,
    refetch: fetchSeatData,
  };
}
