import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  x_refresh_token_expires_in: number;
}

interface QuickBooksErrorResponse {
  error: string;
  error_description: string;
}

serve(async (req) => {
  console.log('🚀 QuickBooks OAuth Callback Function Started');

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

    const { code, state, redirectUri, realmId } = await req.json();
    
    console.log('📋 Processing QuickBooks OAuth callback:', {
      codeLength: code?.length || 0,
      state,
      redirectUri,
      realmId,
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
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ QuickBooks credentials missing');
      return new Response(JSON.stringify({ 
        error: 'QuickBooks OAuth configuration error: Credentials missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ QuickBooks credentials validated');

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
      code,
      redirect_uri: redirectUri,
    };

    console.log('🔐 Starting token exchange with QuickBooks...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
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
        error: 'Failed to connect QuickBooks account',
        details: responseText 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData: QuickBooksTokenResponse = JSON.parse(responseText);
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
    const scopes = ['accounting']; // Default enabled scopes for QuickBooks
    const customersEnabled = true;
    const invoicesEnabled = true;
    const paymentsEnabled = true;
    const itemsEnabled = true;
    const accountsEnabled = true;

    console.log('📊 Enabled services:', {
      customers: customersEnabled,
      invoices: invoicesEnabled,
      payments: paymentsEnabled,
      items: itemsEnabled,
      accounts: accountsEnabled
    });

    // Store integration in database
    const { error: dbError } = await supabaseClient
      .from('quickbooks_integrations')
      .upsert({
        user_id: user.id,
        company_id: profile.company_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000).toISOString(),
        realm_id: realmId,
        scopes,
        customers_enabled: customersEnabled,
        invoices_enabled: invoicesEnabled,
        payments_enabled: paymentsEnabled,
        items_enabled: itemsEnabled,
        accounts_enabled: accountsEnabled,
        is_active: true,
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ QuickBooks integration saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      integration: {
        customers_enabled: customersEnabled,
        invoices_enabled: invoicesEnabled,
        payments_enabled: paymentsEnabled,
        items_enabled: itemsEnabled,
        accounts_enabled: accountsEnabled,
        realm_id: realmId
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 QuickBooks OAuth callback error:', error);
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

