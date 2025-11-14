import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

serve(async (req) => {
  console.log('🚀 HubSpot OAuth Callback Function Started');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { code, state, redirectUri } = await req.json();
    
    console.log('📋 Processing HubSpot OAuth callback:', {
      codeLength: code?.length || 0,
      state,
      redirectUri,
      userId: user.id
    });
    
    if (!code) {
      console.error('❌ Missing authorization code');
      return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required secrets
    const clientId = Deno.env.get('HUBSPOT_CLIENT_ID');
    const clientSecret = Deno.env.get('HUBSPOT_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ HubSpot credentials missing');
      return new Response(JSON.stringify({ 
        error: 'HubSpot OAuth configuration error: Credentials missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ HubSpot credentials validated');

    if (!redirectUri) {
      console.error('❌ No redirect URI provided in request');
      return new Response(JSON.stringify({ 
        error: 'Missing redirect URI in request' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('🔄 Using redirect URI:', redirectUri);

    const tokenParams = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    };

    console.log('🔐 Starting token exchange with HubSpot...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    const responseText = await tokenResponse.text();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        response: responseText,
        redirectUri
      });

      return new Response(JSON.stringify({ 
        error: 'Failed to connect HubSpot account',
        details: responseText 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData: HubSpotTokenResponse = JSON.parse(responseText);
    console.log('✅ Token exchange successful');

    // Get user's company ID from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      console.error('❌ User company not found:', profileError);
      return new Response(JSON.stringify({ error: 'User company not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse scopes to determine which services are enabled
    const scopes = ['contacts', 'companies', 'deals', 'tickets', 'workflows']; // Default enabled scopes
    const contactsEnabled = true;
    const companiesEnabled = true;
    const dealsEnabled = true;
    const ticketsEnabled = true;
    const workflowsEnabled = true;

    console.log('📊 Enabled services:', {
      contacts: contactsEnabled,
      companies: companiesEnabled,
      deals: dealsEnabled,
      tickets: ticketsEnabled,
      workflows: workflowsEnabled
    });

    // Store integration in database
    const { error: dbError } = await supabaseClient
      .from('hubspot_integrations')
      .upsert({
        user_id: user.id,
        company_id: profile.company_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scopes,
        contacts_enabled: contactsEnabled,
        companies_enabled: companiesEnabled,
        deals_enabled: dealsEnabled,
        tickets_enabled: ticketsEnabled,
        workflows_enabled: workflowsEnabled,
        is_active: true,
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ HubSpot integration saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      integration: {
        contacts_enabled: contactsEnabled,
        companies_enabled: companiesEnabled,
        deals_enabled: dealsEnabled,
        tickets_enabled: ticketsEnabled,
        workflows_enabled: workflowsEnabled,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 HubSpot OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



