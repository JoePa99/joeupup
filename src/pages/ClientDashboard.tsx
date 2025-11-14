import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { UnifiedChatArea } from "@/components/ui/unified-chat-area";
import { ConsultationProgressTracker } from "@/components/onboarding/ConsultationProgressTracker";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionRequiredModal } from "@/components/billing/SubscriptionRequiredModal";
import { useSubscriptionRequired } from "@/hooks/useSubscriptionRequired";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { IntegrationStatus } from "@/components/home/IntegrationStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";
import { useIsAdmin } from "@/hooks/useAdminData";
import { HashtagIcon, Cog6ToothIcon, BookOpenIcon, ChartBarIcon, CpuChipIcon } from "@heroicons/react/24/outline";

interface OnboardingSession {
  id: string;
  onboarding_type: string | null;
  consultation_status: string | null;
  status: string;
}

export default function ClientDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isOnboardingComplete } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const agentId = searchParams.get('agent');
  const channelId = searchParams.get('channel');
  const [onboardingSession, setOnboardingSession] = useState<OnboardingSession | null>(null);
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);

  // Check subscription status
  const { 
    showModal: showSubscriptionModal, 
    setShowModal: setShowSubscriptionModal,
    isAdmin: subscriptionIsAdmin, 
    companyId: userCompanyId,
    isLoading: isLoadingSubscription 
  } = useSubscriptionRequired();

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user, isOnboardingComplete]);

  const checkOnboardingStatus = async () => {
    try {
      const { data: session, error } = await supabase
        .from('onboarding_sessions')
        .select('id, onboarding_type, consultation_status, status')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching onboarding session:', error);
      } else {
        setOnboardingSession(session);
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleChannelCreated = (channelId: string) => {
    navigate(`/client-dashboard?channel=${channelId}`);
  };

  const quickActions = [
    {
      label: "Create Channel",
      icon: HashtagIcon,
      onClick: () => setCreateChannelModalOpen(true),
    },
    {
      label: "Settings",
      icon: Cog6ToothIcon,
      onClick: () => navigate("/settings"),
    },
    {
      label: "Playbook",
      icon: BookOpenIcon,
      onClick: () => navigate("/playbook"),
    },
    {
      label: "Usage & Billing",
      icon: ChartBarIcon,
      onClick: () => navigate("/client-dashboard/usage"),
    },
    ...(isAdmin ? [{
      label: "Company Agents",
      icon: CpuChipIcon,
      onClick: () => navigate("/company-agents"),
    }] : []),
  ];

  // Show consultation tracker if user has consultation onboarding that's not completed
  const showConsultationTracker = onboardingSession?.onboarding_type === 'consulting' && !isOnboardingComplete;

  // Show chat area if channel or agent is selected
  const showChatArea = channelId || agentId;

  return (
    <div className="h-full bg-white">
      {showConsultationTracker ? (
        <ConsultationProgressTracker />
      ) : showChatArea ? (
        <UnifiedChatArea agentId={agentId || undefined} channelId={channelId || undefined} />
      ) : (
        <div className="flex-1 p-4 sm:p-6 bg-white w-full overflow-y-auto">
          <div className="container mx-auto w-full space-y-6 sm:space-y-8">
            {/* Welcome Header */}
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Welcome Back!</h2>
              <p className="text-text-secondary text-sm sm:text-base">Here's what's happening with your AI workspace</p>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {/* Recent Activities */}
              <div className="space-y-4">
                <Card className="p-4 sm:p-6 shadow-none border border-gray-200">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Recent Activities</h3>
                  <ActivityFeed limit={5} />
                </Card>
              </div>

              {/* Integration Status */}
              <div className="space-y-4">
                <Card className="p-4 sm:p-6 shadow-none border border-gray-200">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Integration Status</h3>
                  <IntegrationStatus />
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <Card className="p-4 sm:p-6 shadow-none border border-gray-200">
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    {quickActions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={index}
                          variant="ghost"
                          className="w-full justify-start hover:bg-gray-50 text-gray-700 hover:text-gray-900 h-10 px-3"
                          onClick={action.onClick}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          <span className="text-sm">{action.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Subscription Required Modal */}
      {showSubscriptionModal && userCompanyId && (
        <SubscriptionRequiredModal
          isOpen={showSubscriptionModal}
          onClose={subscriptionIsAdmin ? () => setShowSubscriptionModal(false) : undefined}
          companyId={userCompanyId}
          isAdmin={subscriptionIsAdmin}
        />
      )}

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={createChannelModalOpen}
        onClose={() => setCreateChannelModalOpen(false)}
        onChannelCreated={handleChannelCreated}
      />
    </div>
  );
}