import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if company has an active subscription
 * Returns whether a subscription modal should be shown
 */
export const useSubscriptionRequired = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get user's profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('company_id, role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.company_id) {
          setIsLoading(false);
          return;
        }

        setCompanyId(profile.company_id);
        setIsAdmin(profile.role === 'admin');

        // Get company subscription status
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('plan_id, subscription_status')
          .eq('id', profile.company_id)
          .single();

        if (companyError) {
          setIsLoading(false);
          return;
        }

        // Show modal if no plan_id or subscription is not active
        const hasActiveSub = 
          company.plan_id && 
          (company.subscription_status === 'active' || company.subscription_status === 'trialing');

        setShowModal(!hasActiveSub);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsLoading(false);
      }
    };

    checkSubscription();

    // Subscribe to real-time updates
    if (user && companyId) {
      const channel = supabase
        .channel('company-subscription-check')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'companies',
            filter: `id=eq.${companyId}`,
          },
          (payload) => {
            const newCompany = payload.new as any;
            const hasActiveSub = 
              newCompany.plan_id && 
              (newCompany.subscription_status === 'active' || newCompany.subscription_status === 'trialing');
            
            setShowModal(!hasActiveSub);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, companyId]);

  return {
    showModal,
    setShowModal,
    isAdmin,
    companyId,
    isLoading,
  };
};

