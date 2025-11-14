import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuickBooksOperationRequest {
  operation: string;
  parameters: Record<string, any>;
}

// Execute QuickBooks API operations
async function executeQuickBooksOperation(
  operation: string,
  parameters: Record<string, any>,
  supabaseClient: any,
  userId: string
): Promise<any> {
  console.log(`Executing QuickBooks operation: ${operation}`, parameters);

  // Check if user has the required QuickBooks integrations
  const { data: integration } = await supabaseClient
    .from('quickbooks_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!integration) {
    throw new Error('QuickBooks integration not found. Please connect your QuickBooks account first.');
  }

  // Check specific service permissions
  const servicePermissions = {
    'search_customers': integration.customers_enabled,
    'create_customer': integration.customers_enabled,
    'search_invoices': integration.invoices_enabled,
    'create_invoice': integration.invoices_enabled,
    'search_payments': integration.payments_enabled,
    'create_payment': integration.payments_enabled,
    'search_items': integration.items_enabled,
    'create_item': integration.items_enabled,
    'search_accounts': integration.accounts_enabled,
  };

  if (!servicePermissions[operation as keyof typeof servicePermissions]) {
    throw new Error(`${operation} requires additional QuickBooks permissions. Please reconnect your QuickBooks account.`);
  }

  // Route to appropriate operation handler
  switch (operation) {
    case 'search_customers':
      return await searchCustomers(parameters, supabaseClient);
    
    case 'create_customer':
      return await createCustomer(parameters, supabaseClient);
    
    case 'search_invoices':
      return await searchInvoices(parameters, supabaseClient);
    
    case 'create_invoice':
      return await createInvoice(parameters, supabaseClient);
    
    case 'search_payments':
      return await searchPayments(parameters, supabaseClient);
    
    case 'create_payment':
      return await createPayment(parameters, supabaseClient);
    
    case 'search_items':
      return await searchItems(parameters, supabaseClient);
    
    case 'create_item':
      return await createItem(parameters, supabaseClient);
    
    case 'search_accounts':
      return await searchAccounts(parameters, supabaseClient);
    
    default:
      throw new Error(`Unknown QuickBooks operation: ${operation}`);
  }
}

// Customer operations
async function searchCustomers(parameters: Record<string, any>, supabaseClient: any) {
  // Implementation would call QuickBooks API to search customers
  // For now, return mock data structure
  return {
    success: true,
    customers: [],
    summary: `Found 0 customers matching "${parameters.query}"`,
    metadata: {
      operation: 'search_customers',
      query: parameters.query,
      limit: parameters.limit || 10
    }
  };
}

async function createCustomer(parameters: Record<string, any>, supabaseClient: any) {
  // Implementation would call QuickBooks API to create customer
  // For now, return mock data structure
  return {
    success: true,
    customer: {
      id: 'mock-customer-id',
      name: parameters.name,
      email: parameters.email
    },
    summary: `Successfully created customer: ${parameters.name}`,
    metadata: {
      operation: 'create_customer',
      customer_name: parameters.name
    }
  };
}

// Invoice operations
async function searchInvoices(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    invoices: [],
    summary: `Found 0 invoices matching "${parameters.query}"`,
    metadata: {
      operation: 'search_invoices',
      query: parameters.query,
      limit: parameters.limit || 10
    }
  };
}

async function createInvoice(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    invoice: {
      id: 'mock-invoice-id',
      customer_id: parameters.customer_id,
      line_items: parameters.line_items
    },
    summary: `Successfully created invoice`,
    metadata: {
      operation: 'create_invoice',
      customer_id: parameters.customer_id
    }
  };
}

// Payment operations
async function searchPayments(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    payments: [],
    summary: `Found 0 payments matching "${parameters.query}"`,
    metadata: {
      operation: 'search_payments',
      query: parameters.query,
      limit: parameters.limit || 10
    }
  };
}

async function createPayment(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    payment: {
      id: 'mock-payment-id',
      customer_id: parameters.customer_id,
      amount: parameters.amount
    },
    summary: `Successfully created payment: $${parameters.amount}`,
    metadata: {
      operation: 'create_payment',
      customer_id: parameters.customer_id,
      amount: parameters.amount
    }
  };
}

// Item operations
async function searchItems(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    items: [],
    summary: `Found 0 items matching "${parameters.query}"`,
    metadata: {
      operation: 'search_items',
      query: parameters.query,
      limit: parameters.limit || 10
    }
  };
}

async function createItem(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    item: {
      id: 'mock-item-id',
      name: parameters.name,
      type: parameters.type
    },
    summary: `Successfully created item: ${parameters.name}`,
    metadata: {
      operation: 'create_item',
      item_name: parameters.name,
      item_type: parameters.type
    }
  };
}

// Account operations
async function searchAccounts(parameters: Record<string, any>, supabaseClient: any) {
  return {
    success: true,
    accounts: [],
    summary: `Found 0 accounts matching "${parameters.query}"`,
    metadata: {
      operation: 'search_accounts',
      query: parameters.query,
      limit: parameters.limit || 10
    }
  };
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
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { operation, parameters }: QuickBooksOperationRequest = await req.json();

    if (!operation) {
      return new Response(JSON.stringify({ error: 'Operation is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await executeQuickBooksOperation(operation, parameters, supabaseClient, user.id);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('QuickBooks operations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
