import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define available QuickBooks tools for AI agents
const QUICKBOOKS_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_quickbooks_customers",
      description: "Search QuickBooks customers for relevant information. Use this when the user asks about customers, clients, or customer information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for customers (e.g., 'John Smith', 'Acme Corp', 'john@example.com')"
          },
          limit: {
            type: "number",
            description: "Maximum number of customers to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quickbooks_customer",
      description: "Create a new QuickBooks customer. Use this when the user wants to add a new customer to QuickBooks.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Customer name (required)"
          },
          email: {
            type: "string",
            description: "Customer email address"
          },
          phone: {
            type: "string",
            description: "Customer phone number"
          },
          company_name: {
            type: "string",
            description: "Customer company name"
          },
          billing_address: {
            type: "object",
            description: "Billing address object with line1, city, country, postal_code"
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_quickbooks_invoices",
      description: "Search QuickBooks invoices for relevant information. Use this when the user asks about invoices, billing, or payment status.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for invoices (e.g., 'INV-001', 'unpaid', 'overdue')"
          },
          limit: {
            type: "number",
            description: "Maximum number of invoices to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quickbooks_invoice",
      description: "Create a new QuickBooks invoice. Use this when the user wants to create a new invoice.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "QuickBooks customer ID (required)"
          },
          line_items: {
            type: "array",
            description: "Array of line items with amount, description, and item_id"
          },
          due_date: {
            type: "string",
            description: "Invoice due date (ISO 8601 format)"
          },
          invoice_date: {
            type: "string",
            description: "Invoice date (ISO 8601 format)"
          }
        },
        required: ["customer_id", "line_items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_quickbooks_payments",
      description: "Search QuickBooks payments for relevant information. Use this when the user asks about payments, receipts, or payment history.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for payments (e.g., 'PAY-001', 'credit card', 'bank transfer')"
          },
          limit: {
            type: "number",
            description: "Maximum number of payments to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quickbooks_payment",
      description: "Create a new QuickBooks payment. Use this when the user wants to record a payment.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "string",
            description: "QuickBooks customer ID (required)"
          },
          amount: {
            type: "number",
            description: "Payment amount (required)"
          },
          payment_method: {
            type: "string",
            description: "Payment method (e.g., 'Cash', 'Check', 'Credit Card')"
          },
          payment_date: {
            type: "string",
            description: "Payment date (ISO 8601 format)"
          },
          invoice_id: {
            type: "string",
            description: "Associated invoice ID"
          }
        },
        required: ["customer_id", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_quickbooks_items",
      description: "Search QuickBooks items for relevant information. Use this when the user asks about products, services, or inventory items.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for items (e.g., 'Product A', 'Service B', 'SKU-123')"
          },
          limit: {
            type: "number",
            description: "Maximum number of items to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quickbooks_item",
      description: "Create a new QuickBooks item. Use this when the user wants to add a new product or service.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Item name (required)"
          },
          type: {
            type: "string",
            description: "Item type (e.g., 'Service', 'Inventory', 'NonInventory')",
            enum: ["Service", "Inventory", "NonInventory"]
          },
          unit_price: {
            type: "number",
            description: "Unit price for the item"
          },
          description: {
            type: "string",
            description: "Item description"
          },
          sku: {
            type: "string",
            description: "Item SKU"
          }
        },
        required: ["name", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_quickbooks_accounts",
      description: "Search QuickBooks accounts for relevant information. Use this when the user asks about chart of accounts, account balances, or financial accounts.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for accounts (e.g., 'Cash', 'Accounts Receivable', 'Sales')"
          },
          limit: {
            type: "number",
            description: "Maximum number of accounts to return (default: 10)",
            default: 10
          }
        },
        required: ["query"]
      }
    }
  }
];

async function executeQuickBooksTool(toolName: string, parameters: any, supabaseClient: any, userId: string) {
  console.log(`Executing QuickBooks tool: ${toolName}`, parameters);

  switch (toolName) {
    case 'search_quickbooks_customers':
      const customersResponse = await supabaseClient.functions.invoke('quickbooks-customers-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (customersResponse.error) {
        throw new Error(`QuickBooks customers search failed: ${customersResponse.error.message}`);
      }
      
      return {
        summary: `Found ${customersResponse.data.QueryResponse?.Customer?.length || 0} QuickBooks customers`,
        customers: customersResponse.data.QueryResponse?.Customer || []
      };

    case 'create_quickbooks_customer':
      const createCustomerResponse = await supabaseClient.functions.invoke('quickbooks-customers-create', {
        body: {
          name: parameters.name,
          email: parameters.email,
          phone: parameters.phone,
          company_name: parameters.company_name,
          billing_address: parameters.billing_address
        }
      });
      
      if (createCustomerResponse.error) {
        throw new Error(`QuickBooks customer creation failed: ${createCustomerResponse.error.message}`);
      }
      
      return {
        summary: `Successfully created QuickBooks customer: ${parameters.name}`,
        customer: createCustomerResponse.data
      };

    case 'search_quickbooks_invoices':
      const invoicesResponse = await supabaseClient.functions.invoke('quickbooks-invoices-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (invoicesResponse.error) {
        throw new Error(`QuickBooks invoices search failed: ${invoicesResponse.error.message}`);
      }
      
      return {
        summary: `Found ${invoicesResponse.data.QueryResponse?.Invoice?.length || 0} QuickBooks invoices`,
        invoices: invoicesResponse.data.QueryResponse?.Invoice || []
      };

    case 'create_quickbooks_invoice':
      const createInvoiceResponse = await supabaseClient.functions.invoke('quickbooks-invoices-create', {
        body: {
          customer_id: parameters.customer_id,
          line_items: parameters.line_items,
          due_date: parameters.due_date,
          invoice_date: parameters.invoice_date
        }
      });
      
      if (createInvoiceResponse.error) {
        throw new Error(`QuickBooks invoice creation failed: ${createInvoiceResponse.error.message}`);
      }
      
      return {
        summary: `Successfully created QuickBooks invoice`,
        invoice: createInvoiceResponse.data
      };

    case 'search_quickbooks_payments':
      const paymentsResponse = await supabaseClient.functions.invoke('quickbooks-payments-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (paymentsResponse.error) {
        throw new Error(`QuickBooks payments search failed: ${paymentsResponse.error.message}`);
      }
      
      return {
        summary: `Found ${paymentsResponse.data.QueryResponse?.Payment?.length || 0} QuickBooks payments`,
        payments: paymentsResponse.data.QueryResponse?.Payment || []
      };

    case 'create_quickbooks_payment':
      const createPaymentResponse = await supabaseClient.functions.invoke('quickbooks-payments-create', {
        body: {
          customer_id: parameters.customer_id,
          amount: parameters.amount,
          payment_method: parameters.payment_method,
          payment_date: parameters.payment_date,
          invoice_id: parameters.invoice_id
        }
      });
      
      if (createPaymentResponse.error) {
        throw new Error(`QuickBooks payment creation failed: ${createPaymentResponse.error.message}`);
      }
      
      return {
        summary: `Successfully created QuickBooks payment: $${parameters.amount}`,
        payment: createPaymentResponse.data
      };

    case 'search_quickbooks_items':
      const itemsResponse = await supabaseClient.functions.invoke('quickbooks-items-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (itemsResponse.error) {
        throw new Error(`QuickBooks items search failed: ${itemsResponse.error.message}`);
      }
      
      return {
        summary: `Found ${itemsResponse.data.QueryResponse?.Item?.length || 0} QuickBooks items`,
        items: itemsResponse.data.QueryResponse?.Item || []
      };

    case 'create_quickbooks_item':
      const createItemResponse = await supabaseClient.functions.invoke('quickbooks-items-create', {
        body: {
          name: parameters.name,
          type: parameters.type,
          unit_price: parameters.unit_price,
          description: parameters.description,
          sku: parameters.sku
        }
      });
      
      if (createItemResponse.error) {
        throw new Error(`QuickBooks item creation failed: ${createItemResponse.error.message}`);
      }
      
      return {
        summary: `Successfully created QuickBooks item: ${parameters.name}`,
        item: createItemResponse.data
      };

    case 'search_quickbooks_accounts':
      const accountsResponse = await supabaseClient.functions.invoke('quickbooks-accounts-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (accountsResponse.error) {
        throw new Error(`QuickBooks accounts search failed: ${accountsResponse.error.message}`);
      }
      
      return {
        summary: `Found ${accountsResponse.data.QueryResponse?.Account?.length || 0} QuickBooks accounts`,
        accounts: accountsResponse.data.QueryResponse?.Account || []
      };

    default:
      throw new Error(`Unknown QuickBooks tool: ${toolName}`);
  }
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

    const { action, toolName, parameters } = await req.json();

    if (action === 'list_tools') {
      // Return available QuickBooks tools for the AI agent
      return new Response(JSON.stringify({ tools: QUICKBOOKS_TOOLS }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'execute_tool') {
      if (!toolName || !parameters) {
        return new Response(JSON.stringify({ error: 'Tool name and parameters required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user has the required QuickBooks integrations
      const { data: integration } = await supabaseClient
        .from('quickbooks_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ 
          error: 'QuickBooks integration not found. Please connect your QuickBooks account first.' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check specific service permissions
      const servicePermissions = {
        'search_quickbooks_customers': integration.customers_enabled,
        'create_quickbooks_customer': integration.customers_enabled,
        'search_quickbooks_invoices': integration.invoices_enabled,
        'create_quickbooks_invoice': integration.invoices_enabled,
        'search_quickbooks_payments': integration.payments_enabled,
        'create_quickbooks_payment': integration.payments_enabled,
        'search_quickbooks_items': integration.items_enabled,
        'create_quickbooks_item': integration.items_enabled,
        'search_quickbooks_accounts': integration.accounts_enabled,
      };

      if (!servicePermissions[toolName as keyof typeof servicePermissions]) {
        return new Response(JSON.stringify({ 
          error: `${toolName} requires additional QuickBooks permissions. Please reconnect your QuickBooks account.` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeQuickBooksTool(toolName, parameters, supabaseClient, user.id);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('QuickBooks agent tools error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

