import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [loading, setLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check onboarding completion when user changes
        if (session?.user) {
          setTimeout(() => {
            checkOnboardingCompletion(session.user.id);
          }, 0);
        } else {
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

      // If no onboarding row exists, check if user was invited
      if (!data && !error) {
        const { data: invitation } = await supabase
          .from('team_invitations')
          .select('id')
          .eq('accepted_by', userId)
          .eq('status', 'accepted')
          .maybeSingle();
        
        // If user has accepted an invitation, skip onboarding
        setIsOnboardingComplete(!!invitation);
        return;
      }
      if (error) {
        console.error('Error checking onboarding:', error.message || error);
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

        if (companyError) {
          console.error('Error creating company:', companyError);
          throw new Error(`Failed to create company: ${companyError.message}`);
        }

        if (!companyResult || (companyResult as any[]).length === 0) {
          throw new Error('Company creation returned no data');
        }

        const company = (companyResult as any[])[0];

        // Create initial onboarding session
        const { error: onboardingError } = await supabase
          .from('onboarding_sessions')
          .insert([{
            user_id: data.user.id,
            company_id: company.id,
            status: 'in_progress',
            current_step: 1,
          }]);

        if (onboardingError) {
          console.error('Error creating onboarding session:', onboardingError);
          // Don't throw here as this is not critical for signup
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
