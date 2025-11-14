import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description: string;
}

serve(async (req) => {
  console.log('🚀 Google OAuth Callback Function Started');

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
    
    console.log('📋 Processing OAuth callback:', {
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
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || clientId.trim() === '') {
      console.error('❌ GOOGLE_CLIENT_ID is missing or empty');
      return new Response(JSON.stringify({ 
        error: 'Google OAuth configuration error: Client ID missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clientSecret || clientSecret.trim() === '') {
      console.error('❌ GOOGLE_CLIENT_SECRET is missing or empty');
      return new Response(JSON.stringify({ 
        error: 'Google OAuth configuration error: Client Secret missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ OAuth credentials validated');

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
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };

    console.log('🔐 Starting token exchange with Google...');
    console.log('📤 Token exchange parameters:', {
      client_id: clientId.substring(0, 20) + '...',
      client_secret: clientSecret ? '***configured***' : 'missing',
      redirect_uri: redirectUri,
      code_length: code.length,
      grant_type: 'authorization_code'
    });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    const responseText = await tokenResponse.text();
    
    if (!tokenResponse.ok) {
      let errorDetails: GoogleErrorResponse;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = { error: 'unknown', error_description: responseText };
      }

      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        error: errorDetails.error,
        description: errorDetails.error_description,
        redirectUri
      });

      // Provide more specific error messages
      let userMessage = 'Failed to connect Google account';
      if (errorDetails.error === 'invalid_grant') {
        userMessage = 'Authorization expired or already used. Please try connecting again.';
      } else if (errorDetails.error === 'redirect_uri_mismatch') {
        userMessage = 'Redirect URI mismatch. Please contact support.';
      }

      return new Response(JSON.stringify({ 
        error: userMessage,
        details: errorDetails.error_description 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData: GoogleTokenResponse = JSON.parse(responseText);
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
    const scopes = tokenData.scope.split(' ');
    const gmailEnabled = scopes.some(scope => scope.includes('gmail'));
    const driveEnabled = scopes.some(scope => scope.includes('drive'));
    const sheetsEnabled = scopes.some(scope => scope.includes('spreadsheets'));
    const docsEnabled = scopes.some(scope => scope.includes('documents'));
    const calendarEnabled = scopes.some(scope => scope.includes('calendar'));

    console.log('📊 Enabled services:', {
      gmail: gmailEnabled,
      drive: driveEnabled,
      sheets: sheetsEnabled,
      docs: docsEnabled,
      calendar: calendarEnabled
    });

    console.log('💾 Storing integration for user:', {
      userId: user.id,
      companyId: profile.company_id,
      scopesCount: scopes.length,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    });

    // Store integration in database
    const { error: dbError } = await supabaseClient
      .from('google_integrations')
      .upsert({
        user_id: user.id,
        company_id: profile.company_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scopes,
        gmail_enabled: gmailEnabled,
        drive_enabled: driveEnabled,
        sheets_enabled: sheetsEnabled,
        docs_enabled: docsEnabled,
        calendar_enabled: calendarEnabled,
        is_active: true,
      }, {
        onConflict: 'user_id,company_id'
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Failed to save integration',
        details: dbError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Google integration saved successfully');

    // Start background sync if requested
    if (state && state.includes('sync')) {
      console.log('🔄 Starting background sync...');
      
      // Trigger background sync jobs (don't wait for completion)
      const syncPromises = [];
      
      if (gmailEnabled) {
        syncPromises.push(
          supabaseClient.functions.invoke('gmail-sync-messages', {
            body: { userId: user.id, companyId: profile.company_id }
          }).catch(error => console.error('Gmail sync failed:', error))
        );
      }
      
      if (driveEnabled) {
        syncPromises.push(
          supabaseClient.functions.invoke('drive-sync-files', {
            body: { userId: user.id, companyId: profile.company_id }
          }).catch(error => console.error('Drive sync failed:', error))
        );
      }

      // Start syncs in background
      Promise.all(syncPromises).then(() => {
        console.log('🎉 Background sync initiated');
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      integration: {
        gmail_enabled: gmailEnabled,
        drive_enabled: driveEnabled,
        sheets_enabled: sheetsEnabled,
        docs_enabled: docsEnabled,
        calendar_enabled: calendarEnabled,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 OAuth callback error:', error);
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