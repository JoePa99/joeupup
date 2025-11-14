import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickBooksOAuthButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function QuickBooksOAuthButton({ 
  onSuccess, 
  className,
  variant = "outline",
  size = "default" 
}: QuickBooksOAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleQuickBooksOAuth = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect your QuickBooks account.",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Define the scopes for QuickBooks integration
      const scopes = [
        'com.intuit.quickbooks.accounting'
      ].join(' ');

      // Dynamic redirect URI based on current environment
      const redirectUri = `${window.location.origin}/quickbooks-oauth-callback`;
      
      // Get the QuickBooks Client ID from environment
      const quickbooksClientId = import.meta.env.VITE_QUICKBOOKS_CLIENT_ID || "YOUR_QUICKBOOKS_CLIENT_ID";
      
      if (!quickbooksClientId || quickbooksClientId === "YOUR_QUICKBOOKS_CLIENT_ID") {
        throw new Error('QuickBooks Client ID not configured.');
      }
      
      console.log('Starting QuickBooks OAuth with redirect URI:', redirectUri);
      
      // Build OAuth URL using the QuickBooks format
      const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
      authUrl.searchParams.append('client_id', quickbooksClientId);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('state', 'sync');

      console.log('QuickBooks OAuth URL:', authUrl.toString());

      // Use redirect approach
      window.location.href = authUrl.toString();

    } catch (error) {
      console.error('QuickBooks OAuth error:', error);
      setIsLoading(false);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect QuickBooks account.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleQuickBooksOAuth}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Connecting...
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Connect QuickBooks
        </div>
      )}
    </Button>
  );
}
