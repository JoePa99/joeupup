-- Add QuickBooks tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'quickbooks_customers_search',
  'QuickBooks Customer Search',
  'quickbooks',
  'Search QuickBooks customers for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for customers (e.g., ''John Smith'', ''Acme Corp'', ''john@example.com'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of customers to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_customers_create',
  'QuickBooks Customer Creation',
  'quickbooks',
  'Create a new QuickBooks customer',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Customer name (required)"
      },
      "email": {
        "type": "string",
        "description": "Customer email address"
      },
      "phone": {
        "type": "string",
        "description": "Customer phone number"
      },
      "company_name": {
        "type": "string",
        "description": "Customer company name"
      },
      "billing_address": {
        "type": "object",
        "description": "Billing address object with line1, city, country, postal_code"
      }
    },
    "required": ["name"]
  }'::jsonb
),
(
  'quickbooks_invoices_search',
  'QuickBooks Invoice Search',
  'quickbooks',
  'Search QuickBooks invoices for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for invoices (e.g., ''INV-001'', ''unpaid'', ''overdue'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of invoices to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_invoices_create',
  'QuickBooks Invoice Creation',
  'quickbooks',
  'Create a new QuickBooks invoice',
  '{
    "type": "object",
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "QuickBooks customer ID (required)"
      },
      "line_items": {
        "type": "array",
        "description": "Array of line items with amount, description, and item_id"
      },
      "due_date": {
        "type": "string",
        "description": "Invoice due date (ISO 8601 format)"
      },
      "invoice_date": {
        "type": "string",
        "description": "Invoice date (ISO 8601 format)"
      }
    },
    "required": ["customer_id", "line_items"]
  }'::jsonb
),
(
  'quickbooks_payments_search',
  'QuickBooks Payment Search',
  'quickbooks',
  'Search QuickBooks payments for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for payments (e.g., ''PAY-001'', ''credit card'', ''bank transfer'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of payments to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_payments_create',
  'QuickBooks Payment Creation',
  'quickbooks',
  'Create a new QuickBooks payment',
  '{
    "type": "object",
    "properties": {
      "customer_id": {
        "type": "string",
        "description": "QuickBooks customer ID (required)"
      },
      "amount": {
        "type": "number",
        "description": "Payment amount (required)"
      },
      "payment_method": {
        "type": "string",
        "description": "Payment method (e.g., ''Cash'', ''Check'', ''Credit Card'')"
      },
      "payment_date": {
        "type": "string",
        "description": "Payment date (ISO 8601 format)"
      },
      "invoice_id": {
        "type": "string",
        "description": "Associated invoice ID"
      }
    },
    "required": ["customer_id", "amount"]
  }'::jsonb
),
(
  'quickbooks_items_search',
  'QuickBooks Item Search',
  'quickbooks',
  'Search QuickBooks items for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for items (e.g., ''Product A'', ''Service B'', ''SKU-123'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of items to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'quickbooks_items_create',
  'QuickBooks Item Creation',
  'quickbooks',
  'Create a new QuickBooks item',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Item name (required)"
      },
      "type": {
        "type": "string",
        "description": "Item type (e.g., ''Service'', ''Inventory'', ''NonInventory'')",
        "enum": ["Service", "Inventory", "NonInventory"]
      },
      "unit_price": {
        "type": "number",
        "description": "Unit price for the item"
      },
      "description": {
        "type": "string",
        "description": "Item description"
      },
      "sku": {
        "type": "string",
        "description": "Item SKU"
      }
    },
    "required": ["name", "type"]
  }'::jsonb
),
(
  'quickbooks_accounts_search',
  'QuickBooks Account Search',
  'quickbooks',
  'Search QuickBooks accounts for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for accounts (e.g., ''Cash'', ''Accounts Receivable'', ''Sales'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of accounts to return (default: 10)",
        "default": 10
      }
    },
    "required": ["query"]
  }'::jsonb
);

-- Add QuickBooks tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'quickbooks'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add QuickBooks tools to new agents
CREATE OR REPLACE FUNCTION add_quickbooks_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all QuickBooks tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'quickbooks';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add QuickBooks tools to new agents
CREATE TRIGGER trigger_add_quickbooks_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_quickbooks_tools_to_new_agent();

-- Create index for better performance on enabled tool queries
CREATE INDEX IF NOT EXISTS idx_agent_tools_tool_id_enabled 
ON public.agent_tools (tool_id, is_enabled) 
WHERE is_enabled = true;

COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. QuickBooks tools provide financial management capabilities including customer, invoice, payment, and item management.';
