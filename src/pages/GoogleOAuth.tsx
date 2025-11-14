import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { Loader2, CheckCircle, AlertCircle, Mail, FolderOpen, FileText, BarChart3, Calendar } from "lucide-react";

interface GoogleIntegration {
  id: string;
  gmail_enabled: boolean;
  drive_enabled: boolean;
  sheets_enabled: boolean;
  docs_enabled: boolean;
  calendar_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function GoogleOAuth() {
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchIntegration = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching integration:', error);
      } else {
        setIntegration(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, [user]);

  const handleRevokeAccess = async () => {
    if (!integration) return;

    setRevoking(true);
    try {
      const { error } = await supabase
        .from('google_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);

      if (error) {
        throw error;
      }

      setIntegration(null);
      toast({
        title: "Access Revoked",
        description: "Google integration has been disconnected.",
      });
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: "Error",
        description: "Failed to revoke Google access. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  const handleConnectionSuccess = () => {
    fetchIntegration();
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'gmail': return <Mail className="h-4 w-4" />;
      case 'drive': return <FolderOpen className="h-4 w-4" />;
      case 'docs': return <FileText className="h-4 w-4" />;
      case 'sheets': return <BarChart3 className="h-4 w-4" />;
      case 'calendar': return <Calendar className="h-4 w-4" />;
      default: return null;
    }
  };

  const getServiceName = (service: string) => {
    switch (service) {
      case 'gmail': return 'Gmail';
      case 'drive': return 'Google Drive';
      case 'docs': return 'Google Docs';
      case 'sheets': return 'Google Sheets';
      case 'calendar': return 'Google Calendar';
      default: return service;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Google Workspace Integration</h1>
          <p className="text-muted-foreground">
            Connect your Google account to enable AI agents to access your Gmail, Drive, Docs, and Sheets.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google Workspace Connection
            </CardTitle>
            <CardDescription>
              {integration 
                ? "Your Google account is connected and ready for AI agent integration."
                : "Connect your Google account to unlock powerful AI automation features."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {integration ? (
              <>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                  <Badge variant="secondary">Active</Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Enabled Services</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries({
                        gmail: integration.gmail_enabled,
                        drive: integration.drive_enabled,
                        docs: integration.docs_enabled,
                        sheets: integration.sheets_enabled,
                        calendar: integration.calendar_enabled,
                      }).map(([service, enabled]) => (
                        <div key={service} className="flex items-center gap-2 p-2 rounded-lg border">
                          {getServiceIcon(service)}
                          <span className="text-sm font-medium">{getServiceName(service)}</span>
                          {enabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500 ml-auto" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p><strong>Connected:</strong> {new Date(integration.created_at).toLocaleDateString()}</p>
                    <p><strong>Last Updated:</strong> {new Date(integration.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <GoogleOAuthButton 
                    onSuccess={handleConnectionSuccess}
                    variant="outline"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleRevokeAccess}
                    disabled={revoking}
                    variant="destructive"
                    className="flex-1"
                  >
                    {revoking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Not Connected</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Available Services</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <div className="flex items-center gap-3 mb-2">
                          <Mail className="h-5 w-5 text-blue-500" />
                          <span className="font-medium">Gmail Integration</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Search emails, analyze communication patterns, and automate responses.
                        </p>
                      </div>
                      
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <div className="flex items-center gap-3 mb-2">
                          <FolderOpen className="h-5 w-5 text-green-500" />
                          <span className="font-medium">Google Drive Access</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Search files, analyze documents, and manage your content library.
                        </p>
                      </div>
                      
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="h-5 w-5 text-purple-500" />
                          <span className="font-medium">Google Docs & Sheets</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Read, analyze, and extract insights from your documents and spreadsheets.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <GoogleOAuthButton 
                  onSuccess={handleConnectionSuccess}
                  size="lg"
                  className="w-full"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Agent Capabilities</CardTitle>
            <CardDescription>
              Once connected, your AI agents can:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Search and analyze your email history
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Find and summarize documents in your Drive
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Extract data and insights from spreadsheets
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Read and analyze Google Docs content
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Provide contextual answers based on your G Suite data
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}