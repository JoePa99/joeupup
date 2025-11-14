import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HubSpotOAuthButton } from '@/components/auth/HubSpotOAuthButton';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

export default function HubSpotOAuth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkIntegration = async () => {
      if (!user) return;

      try {
        const { data, error } = await (supabase as any)
          .from('hubspot_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking HubSpot integration:', error);
        } else {
          setIntegration(data);
        }
      } catch (error) {
        console.error('Error checking HubSpot integration:', error);
      } finally {
        setLoading(false);
      }
    };

    checkIntegration();
  }, [user]);

  const handleSuccess = () => {
    toast({
      title: "HubSpot Connected Successfully!",
      description: "Your HubSpot account has been connected and is ready to use.",
    });
    navigate('/integrations');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/integrations')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Integrations
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              Connect HubSpot CRM
            </CardTitle>
            <CardDescription className="text-gray-600">
              Connect your HubSpot account to enable AI agents to access your CRM data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {integration ? (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    HubSpot Already Connected
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Your HubSpot account is already connected and ready to use.
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-center space-x-2">
                    {integration.contacts_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Contacts</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.companies_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Companies</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.deals_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Deals</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    {integration.tickets_enabled ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span>Tickets</span>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/integrations')}
                  className="w-full"
                >
                  Go to Integrations
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    By connecting HubSpot, you'll enable AI agents to:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Search and manage contacts</li>
                    <li>Access company information</li>
                    <li>Track deals and opportunities</li>
                    <li>Manage support tickets</li>
                    <li>Create new CRM records</li>
                  </ul>
                </div>
                
                <HubSpotOAuthButton 
                  onSuccess={handleSuccess}
                  className="w-full"
                  size="lg"
                />
                
                <div className="text-xs text-gray-500 text-center">
                  Your data is secure and only accessible by your AI agents.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



