import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  role: 'user' | 'admin' | 'consultant' | 'platform-admin';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  isOnboardingComplete: boolean | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const { toast } = useToast();

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setProfile(null);
        return;
      }

      setProfile(data as UserProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Fetch profile and check onboarding completion when user changes
        if (session?.user) {
          fetchUserProfile(session.user.id);
          setTimeout(() => {
            checkOnboardingCompletion(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setIsOnboardingComplete(null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserProfile(session.user.id);
        checkOnboardingCompletion(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up realtime subscription for onboarding status changes
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('onboarding-status')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'onboarding_sessions', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          console.log('Onboarding status realtime update:', payload);
          const nextStatus = (payload.new as any)?.status;
          if (typeof nextStatus === 'string') {
            const isCompleted = nextStatus === 'completed';
            console.log('Setting onboarding complete to:', isCompleted);
            setIsOnboardingComplete(isCompleted);
          }
        }
      )
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [user]);

  const checkOnboardingCompletion = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('onboarding_sessions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();

      // If no onboarding row exists, mark as incomplete
      if (!data && !error) {
        setIsOnboardingComplete(false);
        return;
      }
      if (error) {
        console.error('Error checking onboarding:', error.message || error);
        setIsOnboardingComplete(false);
        return;
      }

      // If no onboarding row exists, treat as incomplete
      if (!data) {
        setIsOnboardingComplete(false);
        return;
      }

      const isCompleted = data?.status === 'completed' || false;
      console.log('Onboarding status check:', { userId, status: data?.status, isCompleted });
      setIsOnboardingComplete(isCompleted);
    } catch (error) {
      console.error('Error checking onboarding:', error instanceof Error ? error.message : error);
      setIsOnboardingComplete(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error };
  };

  const signUp = async (email: string, password: string, companyName: string) => {
    const redirectUrl = `${window.location.origin}/onboarding`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          company_name: companyName,
        }
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }

    // Create company and profile after successful signup
    if (data.user) {
      try {
        // Create company and link profile atomically using RPC function
        const { data: companyResult, error: companyError } = await (supabase as any)
          .rpc('create_company_and_link_profile', {
            p_company_name: companyName,
            p_user_id: data.user.id
          });

        let companyId: string | null = null;

        if (companyError) {
          const isMissingRpc = companyError.message?.includes('schema cache');

          if (!isMissingRpc) {
            console.error('Error creating company:', companyError);
            throw new Error(`Failed to create company: ${companyError.message}`);
          }

          console.warn('RPC create_company_and_link_profile missing, using fallback flow.');

          const { data: fallbackCompany, error: companyInsertError } = await supabase
            .from('companies')
            .insert({ name: companyName })
            .select('id')
            .single();

          if (companyInsertError) {
            console.error('Error creating company via fallback:', companyInsertError);
            throw new Error(`Failed to create company: ${companyInsertError.message}`);
          }

          companyId = fallbackCompany?.id ?? null;

          if (!companyId) {
            throw new Error('Company creation fallback returned no id');
          }

          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
              company_id: companyId,
              role: 'admin',
            })
            .eq('id', data.user.id);

          if (profileUpdateError) {
            console.error('Error linking profile via fallback:', profileUpdateError);
            throw new Error(`Failed to link profile: ${profileUpdateError.message}`);
          }
        } else {
          if (!companyResult || (companyResult as any[]).length === 0) {
            throw new Error('Company creation returned no data');
          }

          const company = (companyResult as any[])[0];
          companyId = company?.company_id || company?.id || null;

          if (!companyId) {
            throw new Error('Company creation returned an invalid id');
          }
        }

        // Wait for profile to exist before creating onboarding session
        // This prevents foreign key constraint errors from the profile trigger race condition
        const waitForProfile = async (userId: string, maxAttempts = 5) => {
          for (let i = 0; i < maxAttempts; i++) {
            const { data: profileCheck } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', userId)
              .maybeSingle();

            if (profileCheck) return true;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return false;
        };

        const profileExists = await waitForProfile(data.user.id);

        if (profileExists) {
          const { error: onboardingError } = await supabase
            .from('onboarding_sessions')
            .insert([{
              user_id: data.user.id,
              company_id: companyId,
              status: 'in_progress',
              current_step: 1,
            }]);

          if (onboardingError) {
            console.error('Error creating onboarding session:', onboardingError);
          }
        } else {
          console.warn('Profile not created by trigger, onboarding session will be created later');
        }

        // Agents are automatically created by database trigger (seed_default_agents_for_company)
        // when a company is inserted. The trigger clones template agents from agents table
        // where is_default = TRUE and company_id IS NULL

        toast({
          title: "Account created successfully!",
          description: "Please complete your onboarding to get started.",
        });
      } catch (err: any) {
        console.error('Error in post-signup setup:', err);
        toast({
          title: "Setup incomplete",
          description: "Account created but setup failed. You may need to complete setup manually.",
          variant: "destructive",
        });
        return { error: err };
      }
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/login`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password reset sent",
        description: "Check your email for reset instructions.",
      });
    }

    return { error };
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isOnboardingComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
