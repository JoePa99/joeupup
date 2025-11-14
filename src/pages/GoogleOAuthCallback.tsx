import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const GoogleOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Google authorization...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait for auth context to finish loading
        if (loading) {
          setMessage('Checking authentication...');
          return;
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Google OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Google');
        }

        if (!user) {
          // Check session directly to handle auth hydration delays
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.user) {
            throw new Error('User not authenticated');
          }
        }

        setMessage('Exchanging authorization code...');

        console.log('Processing Google OAuth callback with code:', code?.substring(0, 10) + '...');
        
        // Call the edge function to exchange the code for tokens
        // Use the same redirect URI logic as the GoogleOAuthButton
        const isProduction = window.location.hostname.includes('lovable.app');
        const redirectUri = isProduction 
          ? 'https://variable-ai.lovable.app/google-oauth-callback'
          : `${window.location.origin}/google-oauth-callback`;
          
        console.log('Environment check:', { 
          hostname: window.location.hostname, 
          isProduction, 
          redirectUri 
        });
        
        const { data, error: functionError } = await supabase.functions.invoke('google-oauth-callback', {
          body: { code, state, redirectUri }
        });

        if (functionError) {
          console.error('Edge function error:', functionError);
          throw new Error(`Connection failed: ${functionError.message}`);
        }

        if (data?.error) {
          console.error('OAuth error from edge function:', data);
          // Provide more specific error messages based on the error type
          let errorMessage = data.error;
          if (data.error.includes('invalid_grant')) {
            errorMessage = 'Authorization expired or already used. Please try connecting again.';
          } else if (data.error.includes('redirect_uri_mismatch')) {
            errorMessage = 'Redirect URI mismatch. Please contact support.';
          } else if (data.error.includes('configuration error')) {
            errorMessage = 'Google OAuth configuration error. Please contact support.';
          }
          throw new Error(errorMessage);
        }

        console.log('Google OAuth integration successful:', data);
        
        setStatus('success');
        setMessage('Google integration completed successfully!');
        toast.success('Google account connected successfully');

        // Always redirect back to integrations page after success
        setTimeout(() => {
          navigate('/integrations');
        }, 2000);

      } catch (error) {
        console.error('Google OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
        toast.error('Failed to connect Google account');

        // Log error for debugging
      }
    };

    handleCallback();
  }, [searchParams, user, loading, navigate]);

  const handleRetry = () => {
    navigate('/integrations');
  };

  const StatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <StatusIcon />
          </div>
          <CardTitle>
            {status === 'loading' && 'Connecting Google Account'}
            {status === 'success' && 'Connection Successful'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'error' && (
            <Button onClick={handleRetry} variant="outline" className="w-full">
              Return to Integrations
            </Button>
          )}
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              Redirecting to integrations page...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;