import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
  associated_user_scope: string;
  associated_user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
  };
}

serve(async (req) => {
  console.log('🚀 Shopify OAuth Callback Function Started');

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

    const { code, state, redirectUri, shop } = await req.json();
    
    console.log('📋 Processing Shopify OAuth callback:', {
      codeLength: code?.length || 0,
      state,
      redirectUri,
      shop,
      userId: user.id
    });
    
    if (!code) {
      console.error('❌ Missing authorization code');
      return new Response(JSON.stringify({ error: 'Missing authorization code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!shop) {
      console.error('❌ Missing shop parameter');
      return new Response(JSON.stringify({ error: 'Missing shop parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required secrets
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ Shopify credentials missing');
      return new Response(JSON.stringify({ 
        error: 'Shopify OAuth configuration error: Credentials missing'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Shopify credentials validated');

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
    };

    console.log('🔐 Starting token exchange with Shopify...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenParams),
    });

    const responseText = await tokenResponse.text();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        response: responseText,
        redirectUri,
        shop
      });

      return new Response(JSON.stringify({ 
        error: 'Failed to connect Shopify store',
        details: responseText 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData: ShopifyTokenResponse = JSON.parse(responseText);
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
    const scopes = tokenData.scope.split(',');
    const productsEnabled = scopes.some(scope => scope.includes('products'));
    const ordersEnabled = scopes.some(scope => scope.includes('orders'));
    const customersEnabled = scopes.some(scope => scope.includes('customers'));
    const inventoryEnabled = scopes.some(scope => scope.includes('inventory'));
    const analyticsEnabled = scopes.some(scope => scope.includes('analytics'));
    const contentEnabled = scopes.some(scope => scope.includes('content'));
    const themesEnabled = scopes.some(scope => scope.includes('themes'));
    const fulfillmentsEnabled = scopes.some(scope => scope.includes('fulfillments'));
    const shippingEnabled = scopes.some(scope => scope.includes('shipping'));
    const checkoutsEnabled = scopes.some(scope => scope.includes('checkouts'));
    const reportsEnabled = scopes.some(scope => scope.includes('reports'));
    const discountsEnabled = scopes.some(scope => scope.includes('discounts'));

    console.log('📊 Enabled services:', {
      products: productsEnabled,
      orders: ordersEnabled,
      customers: customersEnabled,
      inventory: inventoryEnabled,
      analytics: analyticsEnabled,
      content: contentEnabled,
      themes: themesEnabled,
      fulfillments: fulfillmentsEnabled,
      shipping: shippingEnabled,
      checkouts: checkoutsEnabled,
      reports: reportsEnabled,
      discounts: discountsEnabled
    });

    // Store integration in database
    const { error: dbError } = await supabaseClient
      .from('shopify_integrations')
      .upsert({
        user_id: user.id,
        company_id: profile.company_id,
        shop_domain: shop,
        access_token: tokenData.access_token,
        scopes: scopes,
        associated_user: tokenData.associated_user,
        products_enabled: productsEnabled,
        orders_enabled: ordersEnabled,
        customers_enabled: customersEnabled,
        inventory_enabled: inventoryEnabled,
        analytics_enabled: analyticsEnabled,
        content_enabled: contentEnabled,
        themes_enabled: themesEnabled,
        fulfillments_enabled: fulfillmentsEnabled,
        shipping_enabled: shippingEnabled,
        checkouts_enabled: checkoutsEnabled,
        reports_enabled: reportsEnabled,
        discounts_enabled: discountsEnabled,
        is_active: true,
      });

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save integration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Shopify integration saved successfully');

    return new Response(JSON.stringify({ 
      success: true,
      integration: {
        shop_domain: shop,
        products_enabled: productsEnabled,
        orders_enabled: ordersEnabled,
        customers_enabled: customersEnabled,
        inventory_enabled: inventoryEnabled,
        analytics_enabled: analyticsEnabled,
        content_enabled: contentEnabled,
        themes_enabled: themesEnabled,
        fulfillments_enabled: fulfillmentsEnabled,
        shipping_enabled: shippingEnabled,
        checkouts_enabled: checkoutsEnabled,
        reports_enabled: reportsEnabled,
        discounts_enabled: discountsEnabled,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Shopify OAuth callback error:', error);
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
