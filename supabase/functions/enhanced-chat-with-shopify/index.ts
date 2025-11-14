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

    const { message, conversationId, agentId } = await req.json();

    if (!message || !conversationId) {
      return new Response(JSON.stringify({ error: 'Message and conversation ID are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Shopify integration
    const integration = await getShopifyIntegration(supabaseClient, user.id);
    if (!integration) {
      return new Response(JSON.stringify({ error: 'Shopify integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversation history for context
    const { data: messages } = await supabaseClient
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .is('channel_id', null)
      .order('created_at', { ascending: true })
      .limit(12);
    
    const conversationHistory = messages?.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })) || [];

    // Get shop information for context
    let shopInfo = null;
    try {
      shopInfo = await makeShopifyRequest(integration, '/shop.json');
    } catch (error) {
      console.error('Error fetching shop info:', error);
    }

    // Prepare context for the AI
    const context = {
      shop_domain: integration.shop_domain,
      enabled_services: {
        products: integration.products_enabled,
        orders: integration.orders_enabled,
        customers: integration.customers_enabled,
        inventory: integration.inventory_enabled,
        analytics: integration.analytics_enabled,
        content: integration.content_enabled,
        themes: integration.themes_enabled,
        fulfillments: integration.fulfillments_enabled,
        shipping: integration.shipping_enabled,
        checkouts: integration.checkouts_enabled,
        reports: integration.reports_enabled,
        discounts: integration.discounts_enabled,
      },
      shop_info: shopInfo?.shop || null,
      conversation_history: conversationHistory
    };

    // Call OpenAI API with Shopify context
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are a Shopify e-commerce AI assistant with access to a Shopify store. You can help with:

- Product management (create, update, search products)
- Order processing and tracking
- Customer management
- Inventory management
- Sales analytics and reporting
- Store optimization
- Content management
- Theme customization
- Fulfillment and shipping
- Discount and promotion management

Store Information:
- Shop Domain: ${context.shop_domain}
- Enabled Services: ${JSON.stringify(context.enabled_services, null, 2)}
${context.shop_info ? `- Shop Name: ${context.shop_info.name}\n- Shop Email: ${context.shop_info.email}\n- Shop Currency: ${context.shop_info.currency}\n- Shop Timezone: ${context.shop_info.timezone}` : ''}

When users ask about specific data or want to perform actions, you can use the available Shopify tools to fetch real-time information or make changes to their store.

Always provide helpful, accurate information and suggest specific actions they can take to improve their store performance.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save the conversation messages
    const { error: messageError } = await supabaseClient
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: message,
          agent_id: agentId,
        },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse,
          agent_id: agentId,
        }
      ]);

    if (messageError) {
      console.error('Error saving messages:', messageError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      response: aiResponse,
      context: {
        shop_domain: context.shop_domain,
        enabled_services: context.enabled_services
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhanced chat with Shopify error:', error);
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
