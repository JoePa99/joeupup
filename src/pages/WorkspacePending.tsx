import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, Mail, RefreshCw } from "lucide-react";

export default function WorkspacePending() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [consultantData, setConsultantData] = useState<any>(null);

  useEffect(() => {
    if (user && profile?.company_id) {
      checkWorkspaceStatus();

      // Set up auto-refresh every 30 seconds
      const interval = setInterval(() => {
        checkWorkspaceStatus();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const checkWorkspaceStatus = async () => {
    try {
      setLoading(true);

      // Check onboarding session for workspace_ready status
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('onboarding_sessions')
        .select('workspace_ready, invited_by_consultant')
        .eq('company_id', profile?.company_id)
        .single();

      if (onboardingError) throw onboardingError;

      // If workspace is ready, redirect to chat
      if (onboardingData?.workspace_ready) {
        navigate('/client-dashboard');
        return;
      }

      setWorkspaceData(onboardingData);

      // Fetch consultant info if invited by consultant
      if (onboardingData?.invited_by_consultant) {
        const { data: consultantWorkspace } = await supabase
          .from('consultant_workspaces')
          .select(`
            consultant_id,
            profiles!inner (
              full_name,
              email
            )
          `)
          .eq('company_id', profile?.company_id)
          .single();

        if (consultantWorkspace) {
          setConsultantData(consultantWorkspace);
        }
      }
    } catch (error: any) {
      console.error('Error checking workspace status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    checkWorkspaceStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-yellow-100 p-4">
              <Clock className="w-12 h-12 text-yellow-600" />
            </div>
          </div>
          <CardTitle className="text-3xl mb-2">
            Workspace Setup In Progress
          </CardTitle>
          <CardDescription className="text-lg">
            Your workspace is being configured by your consultant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {consultantData && (
            <div className="bg-muted p-6 rounded-lg">
              <h3 className="font-semibold text-lg mb-3 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Consultant Contact
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">
                    {consultantData.profiles?.full_name || 'Your Consultant'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <a
                    href={`mailto:${consultantData.profiles?.email}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {consultantData.profiles?.email}
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
            <h3 className="font-semibold text-lg mb-3">What's happening?</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-blue-600" />
                <span>Your account has been created successfully</span>
              </li>
              <li className="flex items-start">
                <Clock className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" />
                <span>Your consultant is configuring the CompanyOS</span>
              </li>
              <li className="flex items-start">
                <Clock className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" />
                <span>AI agents are being set up and trained</span>
              </li>
              <li className="flex items-start">
                <Clock className="w-4 h-4 mr-2 mt-0.5 text-yellow-600" />
                <span>Documents and knowledge base are being imported</span>
              </li>
            </ul>
          </div>

          <div className="text-center space-y-3">
            <p className="text-muted-foreground">
              You'll be automatically redirected when your workspace is ready
            </p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Check Status Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
