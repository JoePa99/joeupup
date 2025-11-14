import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function QuickBooksOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const realmId = searchParams.get('realmId');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Get the current redirect URI
        const redirectUri = `${window.location.origin}/quickbooks-oauth-callback`;

        // Call the OAuth callback function
        const { data, error: callbackError } = await supabase.functions.invoke('quickbooks-oauth-callback', {
          body: {
            code,
            state,
            redirectUri,
            realmId
          }
        });

        if (callbackError) {
          throw new Error(callbackError.message || 'OAuth callback failed');
        }

        if (data.success) {
          setStatus('success');
          setMessage('QuickBooks account connected successfully!');
          
          toast({
            title: "Integration Connected",
            description: "Your QuickBooks account has been connected successfully.",
          });

          // Redirect to integrations page after a short delay
          setTimeout(() => {
            navigate('/integrations');
          }, 2000);
        } else {
          throw new Error(data.error || 'Connection failed');
        }

      } catch (error) {
        console.error('QuickBooks OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
        
        toast({
          title: "Connection Failed",
          description: error instanceof Error ? error.message : "Failed to connect QuickBooks account.",
          variant: "destructive",
        });
      }
    };

    handleOAuthCallback();
  }, [user, searchParams, navigate, toast]);

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

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-xl">QuickBooks Integration</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Connecting your QuickBooks account...'}
            {status === 'success' && 'Connection successful!'}
            {status === 'error' && 'Connection failed'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className={`text-sm ${getStatusColor()}`}>
            {message}
          </p>
          
          {status === 'error' && (
            <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground">
              Redirecting to integrations page...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

