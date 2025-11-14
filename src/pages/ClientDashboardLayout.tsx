import { useState, useEffect } from "react";
import { Outlet, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { createInitialConversations } from "@/lib/agent-utils";
import { isChannelAccessible } from "@/lib/channel-utils";
import { useToast } from "@/hooks/use-toast";

interface OnboardingSession {
  id: string;
  onboarding_type: string | null;
  consultation_status: string | null;
  status: string;
}

export default function ClientDashboardLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isOnboardingComplete } = useAuth();
  const channelId = searchParams.get('channel');
  const [onboardingSession, setOnboardingSession] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationsInitialized, setConversationsInitialized] = useState(false);

  // Get the page title based on current route
  const getPageTitle = () => {
    if (location.pathname.includes('/usage')) return 'Usage';
    if (location.pathname.includes('/integrations')) return 'Integrations';
    if (location.pathname.includes('/invite-team')) return 'Team Management';
    if (location.pathname.includes('/playbook')) return 'Playbook';
    if (location.pathname.includes('/settings')) return 'Settings';
    return 'AI Workspace';
  };

  useEffect(() => {
    if (user && !conversationsInitialized) {
      checkOnboardingStatus();
      initializeConversations();
    }
  }, [user, conversationsInitialized, isOnboardingComplete]);

  // Validate channel access when channelId changes
  useEffect(() => {
    const validateChannelAccess = async () => {
      if (channelId && user) {
        const hasAccess = await isChannelAccessible(channelId);
        if (!hasAccess) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this channel.",
            variant: "destructive",
          });
          // Redirect to dashboard without channel parameter
          navigate('/client-dashboard');
        }
      }
    };

    validateChannelAccess();
  }, [channelId, user, navigate, toast]);

  const initializeConversations = async () => {
    if (!user) return;

    try {
      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profile?.company_id) {
        const result = await createInitialConversations(user.id, profile.company_id);
        if (result.success && result.created > 0) {
          console.log(`Created ${result.created} initial conversations`);
        }
      }
    } catch (error) {
      console.error('Error initializing conversations:', error);
    } finally {
      setConversationsInitialized(true);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      // Check if user has an active consultation onboarding
      const {
        data: session,
        error
      } = await supabase
        .from('onboarding_sessions')
        .select('id, onboarding_type, consultation_status, status')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error
        console.error('Error fetching onboarding session:', error);
      } else {
        setOnboardingSession(session);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Loading Dashboard
          </h2>
          <p className="text-muted-foreground">
            Setting up your workspace...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white">
        <AppSidebar />
        <main className="flex-1 flex flex-col bg-white">
          {/* Header with sidebar trigger */}
          <header className="h-14 md:h-12 flex items-center border-b border-border px-4 sm:px-6 bg-white">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <h1 className="text-lg md:text-lg font-semibold">
              {getPageTitle()}
            </h1>
          </header>
          
          {/* Main content area - renders nested routes */}
          <div className="flex-1 bg-white overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}






























