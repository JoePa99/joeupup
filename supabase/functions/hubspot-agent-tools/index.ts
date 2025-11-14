import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define available HubSpot tools for AI agents
const HUBSPOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_hubspot_contacts",
      description: "Search HubSpot contacts for relevant information. Use this when the user asks about contacts, leads, or customer information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for contacts (e.g., 'john@example.com', 'John Smith', 'Acme Corp')"
          },
          limit: {
            type: "number",
            description: "Maximum number of contacts to return (default: 10)",
            default: 10
          },
          properties: {
            type: "array",
            description: "Specific properties to return (e.g., ['email', 'firstname', 'lastname', 'phone', 'company'])",
            items: { type: "string" }
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_hubspot_contact",
      description: "Create a new HubSpot contact. Use this when the user wants to add a new contact to HubSpot.",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "Contact email address (required)"
          },
          first_name: {
            type: "string",
            description: "Contact's first name"
          },
          last_name: {
            type: "string",
            description: "Contact's last name"
          },
          phone: {
            type: "string",
            description: "Contact's phone number"
          },
          company: {
            type: "string",
            description: "Contact's company name"
          },
          job_title: {
            type: "string",
            description: "Contact's job title"
          }
        },
        required: ["email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_hubspot_contact",
      description: "Update an existing HubSpot contact. Use this when the user wants to modify contact information.",
      parameters: {
        type: "object",
        properties: {
          contact_id: {
            type: "string",
            description: "HubSpot contact ID"
          },
          properties: {
            type: "object",
            description: "Properties to update (e.g., {firstname: 'John', lastname: 'Doe', phone: '+1234567890'})"
          }
        },
        required: ["contact_id", "properties"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_hubspot_companies",
      description: "Search HubSpot companies for relevant information. Use this when the user asks about companies, organizations, or business information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for companies (e.g., 'Acme Corp', 'tech startup', 'manufacturing')"
          },
          limit: {
            type: "number",
            description: "Maximum number of companies to return (default: 10)",
            default: 10
          },
          properties: {
            type: "array",
            description: "Specific properties to return (e.g., ['name', 'domain', 'industry', 'city', 'state'])",
            items: { type: "string" }
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_hubspot_company",
      description: "Create a new HubSpot company. Use this when the user wants to add a new company to HubSpot.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Company name (required)"
          },
          domain: {
            type: "string",
            description: "Company domain"
          },
          industry: {
            type: "string",
            description: "Company industry"
          },
          city: {
            type: "string",
            description: "Company city"
          },
          state: {
            type: "string",
            description: "Company state"
          },
          country: {
            type: "string",
            description: "Company country"
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_hubspot_deals",
      description: "Search HubSpot deals for relevant information. Use this when the user asks about sales deals, opportunities, or revenue.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for deals (e.g., 'Q4 deal', 'enterprise', 'renewal')"
          },
          limit: {
            type: "number",
            description: "Maximum number of deals to return (default: 10)",
            default: 10
          },
          properties: {
            type: "array",
            description: "Specific properties to return (e.g., ['dealname', 'dealstage', 'amount', 'closedate'])",
            items: { type: "string" }
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_hubspot_deal",
      description: "Create a new HubSpot deal. Use this when the user wants to add a new sales deal to HubSpot.",
      parameters: {
        type: "object",
        properties: {
          deal_name: {
            type: "string",
            description: "Deal name (required)"
          },
          deal_stage: {
            type: "string",
            description: "Deal stage (e.g., 'appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled')"
          },
          amount: {
            type: "number",
            description: "Deal amount"
          },
          currency: {
            type: "string",
            description: "Currency code (e.g., 'USD', 'EUR')"
          },
          close_date: {
            type: "string",
            description: "Expected close date (ISO 8601 format)"
          },
          deal_type: {
            type: "string",
            description: "Deal type (e.g., 'newbusiness', 'existingbusiness')"
          }
        },
        required: ["deal_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_hubspot_deal",
      description: "Update an existing HubSpot deal. Use this when the user wants to modify deal information.",
      parameters: {
        type: "object",
        properties: {
          deal_id: {
            type: "string",
            description: "HubSpot deal ID"
          },
          properties: {
            type: "object",
            description: "Properties to update (e.g., {dealstage: 'closedwon', amount: '50000'})"
          }
        },
        required: ["deal_id", "properties"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_hubspot_tickets",
      description: "Search HubSpot tickets for relevant information. Use this when the user asks about support tickets, customer issues, or help requests.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for tickets (e.g., 'login issue', 'billing problem', 'feature request')"
          },
          limit: {
            type: "number",
            description: "Maximum number of tickets to return (default: 10)",
            default: 10
          },
          properties: {
            type: "array",
            description: "Specific properties to return (e.g., ['subject', 'content', 'hs_pipeline_stage', 'hs_ticket_priority'])",
            items: { type: "string" }
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_hubspot_ticket",
      description: "Create a new HubSpot ticket. Use this when the user wants to create a support ticket or customer issue.",
      parameters: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "Ticket subject (required)"
          },
          content: {
            type: "string",
            description: "Ticket content/description"
          },
          priority: {
            type: "string",
            description: "Ticket priority (e.g., 'LOW', 'MEDIUM', 'HIGH')"
          },
          category: {
            type: "string",
            description: "Ticket category"
          },
          hs_pipeline: {
            type: "string",
            description: "HubSpot pipeline ID"
          },
          hs_pipeline_stage: {
            type: "string",
            description: "HubSpot pipeline stage"
          }
        },
        required: ["subject"]
      }
    }
  }
];

async function executeHubSpotTool(toolName: string, parameters: any, supabaseClient: any, userId: string) {
  console.log(`Executing HubSpot tool: ${toolName}`, parameters);

  // Map tool names to operations
  const toolToOperationMap: { [key: string]: string } = {
    'search_hubspot_contacts': 'search_contacts',
    'create_hubspot_contact': 'create_contact',
    'update_hubspot_contact': 'update_contact',
    'search_hubspot_companies': 'search_companies',
    'create_hubspot_company': 'create_company',
    'search_hubspot_deals': 'search_deals',
    'create_hubspot_deal': 'create_deal',
    'update_hubspot_deal': 'update_deal',
    'search_hubspot_tickets': 'search_tickets',
    'create_hubspot_ticket': 'create_ticket'
  };

  const operation = toolToOperationMap[toolName];
  if (!operation) {
    throw new Error(`Unknown HubSpot tool: ${toolName}`);
  }

  // Call the unified hubspot-operations function
  const response = await supabaseClient.functions.invoke('hubspot-operations', {
    body: {
      action: 'execute_operation',
      operation: operation,
      parameters: parameters
    }
  });
  
  if (response.error) {
    throw new Error(`HubSpot ${operation} failed: ${response.error.message}`);
  }

  const data = response.data.result;

  // Format response based on operation type
  switch (operation) {
    case 'search_contacts':
      return {
        summary: `Found ${data.results?.length || 0} HubSpot contacts`,
        contacts: data.results || []
      };

    case 'create_contact':
      return {
        summary: `Successfully created HubSpot contact: ${parameters.email}`,
        contact: data
      };

    case 'update_contact':
      return {
        summary: `Successfully updated HubSpot contact: ${parameters.contact_id}`,
        contact: data
      };

    case 'search_companies':
      return {
        summary: `Found ${data.results?.length || 0} HubSpot companies`,
        companies: data.results || []
      };

    case 'create_company':
      return {
        summary: `Successfully created HubSpot company: ${parameters.name}`,
        company: data
      };

    case 'search_deals':
      return {
        summary: `Found ${data.results?.length || 0} HubSpot deals`,
        deals: data.results || []
      };

    case 'create_deal':
      return {
        summary: `Successfully created HubSpot deal: ${parameters.deal_name}`,
        deal: data
      };

    case 'update_deal':
      return {
        summary: `Successfully updated HubSpot deal: ${parameters.deal_id}`,
        deal: data
      };

    case 'search_tickets':
      return {
        summary: `Found ${data.results?.length || 0} HubSpot tickets`,
        tickets: data.results || []
      };

    case 'create_ticket':
      return {
        summary: `Successfully created HubSpot ticket: ${parameters.subject}`,
        ticket: data
      };

    default:
      return {
        summary: `Successfully executed HubSpot operation: ${operation}`,
        data: data
      };
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
      // Return available HubSpot tools for the AI agent
      return new Response(JSON.stringify({ tools: HUBSPOT_TOOLS }), {
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

      // Check if user has the required HubSpot integrations
      const { data: integration } = await supabaseClient
        .from('hubspot_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ 
          error: 'HubSpot integration not found. Please connect your HubSpot account first.' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check specific service permissions
      const servicePermissions = {
        'search_hubspot_contacts': integration.contacts_enabled,
        'create_hubspot_contact': integration.contacts_enabled,
        'update_hubspot_contact': integration.contacts_enabled,
        'search_hubspot_companies': integration.companies_enabled,
        'create_hubspot_company': integration.companies_enabled,
        'search_hubspot_deals': integration.deals_enabled,
        'create_hubspot_deal': integration.deals_enabled,
        'update_hubspot_deal': integration.deals_enabled,
        'search_hubspot_tickets': integration.tickets_enabled,
        'create_hubspot_ticket': integration.tickets_enabled,
      };

      if (!servicePermissions[toolName as keyof typeof servicePermissions]) {
        return new Response(JSON.stringify({ 
          error: `${toolName} requires additional HubSpot permissions. Please reconnect your HubSpot account.` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeHubSpotTool(toolName, parameters, supabaseClient, user.id);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('HubSpot agent tools error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



