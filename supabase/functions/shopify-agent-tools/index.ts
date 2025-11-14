import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyIntegration {
  id: string;
  user_id: string;
  company_id: string;
  shop_domain: string;
  access_token: string;
  scopes: string[];
  products_enabled: boolean;
  orders_enabled: boolean;
  customers_enabled: boolean;
  inventory_enabled: boolean;
  analytics_enabled: boolean;
  content_enabled: boolean;
  themes_enabled: boolean;
  fulfillments_enabled: boolean;
  shipping_enabled: boolean;
  checkouts_enabled: boolean;
  reports_enabled: boolean;
  discounts_enabled: boolean;
  is_active: boolean;
}

async function getShopifyIntegration(supabaseClient: any, userId: string): Promise<ShopifyIntegration | null> {
  const { data, error } = await supabaseClient
    .from('shopify_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('Error fetching Shopify integration:', error);
    return null;
  }

  return data;
}

async function makeShopifyRequest(integration: ShopifyIntegration, endpoint: string, method: string = 'GET', body?: any) {
  const url = `https://${integration.shop_domain}/admin/api/2023-10${endpoint}`;
  
  const headers: Record<string, string> = {
    'X-Shopify-Access-Token': integration.access_token,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

serve(async (req) => {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { tool, parameters } = await req.json();

    // Get Shopify integration
    const integration = await getShopifyIntegration(supabaseClient, user.id);
    if (!integration) {
      return new Response(JSON.stringify({ error: 'Shopify integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (tool) {
      case 'get_products':
        if (!integration.products_enabled) {
          throw new Error('Products access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/products.json');
        break;

      case 'get_product':
        if (!integration.products_enabled) {
          throw new Error('Products access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, `/products/${parameters.product_id}.json`);
        break;

      case 'create_product':
        if (!integration.products_enabled) {
          throw new Error('Products access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/products.json', 'POST', {
          product: parameters.product
        });
        break;

      case 'update_product':
        if (!integration.products_enabled) {
          throw new Error('Products access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, `/products/${parameters.product_id}.json`, 'PUT', {
          product: parameters.product
        });
        break;

      case 'get_orders':
        if (!integration.orders_enabled) {
          throw new Error('Orders access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/orders.json');
        break;

      case 'get_order':
        if (!integration.orders_enabled) {
          throw new Error('Orders access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, `/orders/${parameters.order_id}.json`);
        break;

      case 'get_customers':
        if (!integration.customers_enabled) {
          throw new Error('Customers access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/customers.json');
        break;

      case 'get_customer':
        if (!integration.customers_enabled) {
          throw new Error('Customers access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, `/customers/${parameters.customer_id}.json`);
        break;

      case 'get_inventory':
        if (!integration.inventory_enabled) {
          throw new Error('Inventory access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/inventory_levels.json');
        break;

      case 'get_analytics':
        if (!integration.analytics_enabled) {
          throw new Error('Analytics access not enabled for this integration');
        }
        result = await makeShopifyRequest(integration, '/reports.json');
        break;

      case 'get_shop_info':
        result = await makeShopifyRequest(integration, '/shop.json');
        break;

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      data: result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Shopify agent tools error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
