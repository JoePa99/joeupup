import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UsageStats, CompanyUsageStats, UsageHistory } from '@/types/usage';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to fetch and subscribe to current user's usage stats
 */
export const useUsage = (includeHistory: boolean = false) => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch usage data - memoized to prevent stale closures
  const fetchUsage = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the Supabase URL and construct the full URL with query params
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = new URLSearchParams({
        scope: 'user',
        includeHistory: includeHistory.toString(),
      });
      
      const functionUrl = `${supabaseUrl}/functions/v1/get-usage-stats?${params.toString()}`;

      // Get the current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Fetch with authorization header
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch usage stats');
      }

      const data = await response.json();

      if (data?.current) {
        setUsage(data.current);
      }

      if (data?.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user, includeHistory]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-usage-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_usage',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Usage updated:', payload);
          // Refetch on changes
          fetchUsage();
        }
      )
      .subscribe((status) => {
        console.log('Usage subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUsage]);

  return {
    usage,
    history,
    isLoading,
    error,
    refetch: fetchUsage,
  };
};

/**
 * Hook to fetch company-wide usage stats (admin only)
 */
export const useCompanyUsage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<CompanyUsageStats[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch company usage - memoized to prevent stale closures
  const fetchCompanyUsage = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get the Supabase URL and construct the full URL with query params
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = new URLSearchParams({
        scope: 'company',
      });
      
      const functionUrl = `${supabaseUrl}/functions/v1/get-usage-stats?${params.toString()}`;

      // Get the current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Fetch with authorization header
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch company usage stats');
      }

      const data = await response.json();

      if (data?.users) {
        setUsers(data.users);
      }

      if (data?.subscription) {
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error('Error fetching company usage:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCompanyUsage();
  }, [fetchCompanyUsage]);

  // Subscribe to real-time updates for any user in the company
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('company-usage-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_usage',
        },
        (payload) => {
          console.log('Company usage updated:', payload);
          // Refetch on changes
          fetchCompanyUsage();
        }
      )
      .subscribe((status) => {
        console.log('Company usage subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCompanyUsage]);

  return {
    users,
    subscription,
    isLoading,
    error,
    refetch: fetchCompanyUsage,
  };
};


