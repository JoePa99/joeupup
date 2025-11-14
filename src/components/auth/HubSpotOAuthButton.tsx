import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface HubSpotOAuthButtonProps {
  onSuccess?: () => void;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function HubSpotOAuthButton({ 
  onSuccess, 
  className,
  variant = "outline",
  size = "default" 
}: HubSpotOAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleHubSpotOAuth = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect your HubSpot account.",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Define the comprehensive scopes for HubSpot integration
      const scopes = 'oauth';
      const optionalScopes = [
        'crm.schemas.quotes.read',
        'crm.objects.subscriptions.write',
        'crm.objects.line_items.read',
        'crm.schemas.subscriptions.write',
        'crm.objects.line_items.write',
        'crm.schemas.invoices.write',
        'crm.schemas.line_items.read',
        'crm.objects.goals.write',
        'crm.export',
        'crm.objects.products.read',
        'crm.objects.products.write',
        'crm.objects.commercepayments.write',
        'crm.schemas.commercepayments.write',
        'crm.objects.goals.read',
        'crm.lists.read',
        'crm.objects.contacts.read',
        'crm.objects.partner-services.read',
        'crm.objects.partner-services.write',
        'crm.extensions_calling_transcripts.read',
        'crm.dealsplits.read_write',
        'crm.extensions_calling_transcripts.write',
        'crm.objects.subscriptions.read',
        'crm.import',
        'crm.schemas.subscriptions.read',
        'crm.schemas.commercepayments.read',
        'crm.objects.commercepayments.read',
        'crm.objects.invoices.read',
        'crm.schemas.invoices.read',
        'crm.objects.users.read',
        'crm.objects.contacts.write',
        'crm.objects.users.write',
        'crm.objects.marketing_events.read',
        'crm.objects.marketing_events.write',
        'crm.schemas.custom.read',
        'crm.objects.custom.read',
        'crm.objects.custom.write',
        'crm.objects.companies.write',
        'crm.schemas.contacts.read',
        'crm.schemas.carts.write',
        'crm.schemas.carts.read',
        'crm.objects.carts.write',
        'crm.objects.carts.read',
        'crm.pipelines.orders.write',
        'crm.pipelines.orders.read',
        'crm.schemas.orders.write',
        'crm.schemas.orders.read',
        'crm.objects.orders.write',
        'crm.objects.orders.read',
        'crm.objects.leads.read',
        'crm.objects.leads.write',
        'crm.objects.partner-clients.read',
        'crm.objects.partner-clients.write',
        'crm.objects.feedback_submissions.read',
        'crm.lists.write',
        'crm.objects.companies.read',
        'crm.objects.deals.read',
        'crm.objects.deals.write',
        'crm.schemas.companies.read',
        'crm.schemas.companies.write',
        'crm.schemas.contacts.write',
        'crm.schemas.deals.read',
        'crm.schemas.deals.write',
        'crm.objects.owners.read',
        'crm.objects.courses.read',
        'crm.objects.courses.write',
        'crm.objects.listings.read',
        'crm.objects.listings.write',
        'crm.objects.services.read',
        'crm.objects.services.write',
        'crm.objects.appointments.read',
        'crm.objects.appointments.write',
        'crm.objects.invoices.write',
        'crm.schemas.services.read',
        'crm.schemas.services.write',
        'crm.schemas.courses.read',
        'crm.schemas.courses.write',
        'crm.schemas.listings.read',
        'crm.schemas.listings.write',
        'crm.objects.quotes.write',
        'crm.schemas.appointments.read',
        'crm.objects.quotes.read',
        'crm.schemas.appointments.write'
      ].join(' ');

      // Dynamic redirect URI based on current environment
      const redirectUri = `${window.location.origin}/hubspot-oauth-callback`;
      
      // Get the HubSpot Client ID from edge function
      const clientIdResponse = await supabase.functions.invoke('get-hubspot-client-id');
      
      if (clientIdResponse.error || !clientIdResponse.data?.client_id) {
        throw new Error('HubSpot Client ID not configured.');
      }
      
      const hubspotClientId = clientIdResponse.data.client_id;
      
      console.log('Starting HubSpot OAuth with redirect URI:', redirectUri);
      
      // Build OAuth URL using the correct HubSpot format
      const authUrl = new URL('https://app-eu1.hubspot.com/oauth/authorize');
      authUrl.searchParams.append('client_id', hubspotClientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', scopes);
      authUrl.searchParams.append('optional_scope', optionalScopes);
      authUrl.searchParams.append('state', 'sync');

      console.log('HubSpot OAuth URL:', authUrl.toString());

      // Use redirect approach
      window.location.href = authUrl.toString();

    } catch (error) {
      console.error('HubSpot OAuth error:', error);
      setIsLoading(false);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect HubSpot account.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleHubSpotOAuth}
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
          Connect HubSpot
        </div>
      )}
    </Button>
  );
}

