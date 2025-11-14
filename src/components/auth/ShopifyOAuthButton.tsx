import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ShopifyOAuthButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function ShopifyOAuthButton({ 
  onSuccess, 
  className,
  variant = "outline",
  size = "default" 
}: ShopifyOAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleShopifyOAuth = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect your Shopify account.",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Define the scopes for Shopify integration
      const scopes = [
        'read_products',
        'write_products',
        'read_orders',
        'write_orders',
        'read_customers',
        'write_customers',
        'read_inventory',
        'write_inventory',
        'read_analytics',
        'read_content',
        'write_content',
        'read_themes',
        'write_themes',
        'read_script_tags',
        'write_script_tags',
        'read_fulfillments',
        'write_fulfillments',
        'read_shipping',
        'write_shipping',
        'read_checkouts',
        'write_checkouts',
        'read_reports',
        'write_reports',
        'read_price_rules',
        'write_price_rules',
        'read_discounts',
        'write_discounts',
        'read_marketing_events',
        'write_marketing_events',
        'read_resource_feedbacks',
        'write_resource_feedbacks',
        'read_translations',
        'write_translations',
        'read_locales',
        'write_locales'
      ].join(',');

      // Dynamic redirect URI based on current environment
      const redirectUri = `${window.location.origin}/shopify-oauth-callback`;
      
      // Get the Shopify Client ID from edge function
      const clientIdResponse = await supabase.functions.invoke('get-shopify-client-id');
      
      if (clientIdResponse.error || !clientIdResponse.data?.client_id) {
        throw new Error('Shopify Client ID not configured.');
      }
      
      const shopifyClientId = clientIdResponse.data.client_id;
      
      console.log('Starting Shopify OAuth with redirect URI:', redirectUri);
      
      // Build OAuth URL using the correct Shopify format
      const authUrl = new URL('https://accounts.shopify.com/oauth/authorize');
      authUrl.searchParams.append('client_id', shopifyClientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('state', 'sync');

      console.log('Shopify OAuth URL:', authUrl.toString());

      // Use redirect approach
      window.location.href = authUrl.toString();

    } catch (error) {
      console.error('Shopify OAuth error:', error);
      setIsLoading(false);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect Shopify account.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleShopifyOAuth}
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
            <path d="M15.337 23.979c-.35 0-.665-.133-.905-.35l-6.177-5.52-2.52 1.95c-.403.308-.92.462-1.44.462-.35 0-.7-.07-1.02-.21l-3.12-1.31c-.77-.32-1.26-1.08-1.26-1.9V3.09c0-.82.49-1.58 1.26-1.9l3.12-1.31c.32-.14.67-.21 1.02-.21.52 0 1.04.15 1.44.46l2.52 1.95 6.177-5.52c.24-.22.555-.35.905-.35.35 0 .665.13.905.35l6.177 5.52 2.52-1.95c.403-.31.92-.46 1.44-.46.35 0 .7.07 1.02.21l3.12 1.31c.77.32 1.26 1.08 1.26 1.9v13.35c0 .82-.49 1.58-1.26 1.9l-3.12 1.31c-.32.14-.67.21-1.02.21-.52 0-1.04-.15-1.44-.46l-2.52-1.95-6.177 5.52c-.24.22-.555.35-.905.35z"/>
          </svg>
          Connect Shopify
        </div>
      )}
    </Button>
  );
}
