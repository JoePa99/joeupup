import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const HubSpotOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`HubSpot OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from HubSpot');
        }

        console.log('Processing HubSpot OAuth callback with code:', code?.substring(0, 10) + '...');

        // Use the same redirect URI logic as the HubSpotOAuthButton
        const isProduction = window.location.hostname !== 'localhost';
        const redirectUri = isProduction 
          ? 'https://preview--variable-ai.lovable.app/hubspot-oauth-callback'
          : `${window.location.origin}/hubspot-oauth-callback`;

        const { data, error: functionError } = await supabase.functions.invoke('hubspot-oauth-callback', {
          body: {
            code,
            state,
            redirectUri
          }
        });

        if (functionError) {
          throw new Error(functionError.message || 'Failed to process HubSpot OAuth callback');
        }

        if (data.success) {
          setStatus('success');
          toast({
            title: "HubSpot Connected Successfully!",
            description: "Your HubSpot account has been connected and is ready to use.",
          });

          // Redirect to integrations page after a short delay
          setTimeout(() => {
            navigate('/integrations');
          }, 2000);
        } else {
          throw new Error(data.error || 'Unknown error occurred');
        }

      } catch (error) {
        console.error('HubSpot OAuth callback error:', error);
        setStatus('error');
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
        
        toast({
          title: "Connection Failed",
          description: error instanceof Error ? error.message : "Failed to connect HubSpot account.",
          variant: "destructive",
        });
      }
    };

    processCallback();
  }, [searchParams, navigate, toast]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'loading':
        return 'Connecting HubSpot...';
      case 'success':
        return 'HubSpot Connected Successfully!';
      case 'error':
        return 'Connection Failed';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'loading':
        return 'Please wait while we connect your HubSpot account.';
      case 'success':
        return 'Your HubSpot account has been connected and is ready to use with AI agents.';
      case 'error':
        return error || 'An error occurred while connecting your HubSpot account.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl font-bold">
            {getStatusTitle()}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {getStatusDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'error' && (
            <div className="space-y-4">
              <Button 
                onClick={() => navigate('/integrations')}
                variant="outline"
                className="w-full"
              >
                Back to Integrations
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                variant="default"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
          {status === 'success' && (
            <div className="text-sm text-gray-500">
              Redirecting to integrations page...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HubSpotOAuthCallback;



