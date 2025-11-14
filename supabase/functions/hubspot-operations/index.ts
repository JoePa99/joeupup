import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Available HubSpot operations
const HUBSPOT_OPERATIONS = [
  'search_contacts',
  'create_contact',
  'update_contact',
  'search_companies',
  'create_company',
  'search_deals',
  'create_deal',
  'update_deal',
  'search_tickets',
  'create_ticket'
];

// Service permission mapping
const SERVICE_PERMISSIONS = {
  'search_contacts': 'contacts_enabled',
  'create_contact': 'contacts_enabled',
  'update_contact': 'contacts_enabled',
  'search_companies': 'companies_enabled',
  'create_company': 'companies_enabled',
  'search_deals': 'deals_enabled',
  'create_deal': 'deals_enabled',
  'update_deal': 'deals_enabled',
  'search_tickets': 'tickets_enabled',
  'create_ticket': 'tickets_enabled',
};

async function getValidAccessToken(supabaseClient: any, userId: string, requiredService: string) {
  const { data: integration } = await supabaseClient
    .from('hubspot_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq(requiredService, true)
    .single();

  if (!integration) {
    throw new Error(`HubSpot ${requiredService.replace('_enabled', '')} integration not found`);
  }

  // Check if token is expired
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  
  if (expiresAt <= now) {
    // Refresh token
    const refreshResponse = await supabaseClient.functions.invoke('hubspot-refresh-token', {
      body: { userId }
    });
    
    if (refreshResponse.error) {
      throw new Error('Failed to refresh token');
    }
    
    return refreshResponse.data.access_token;
  }

  return integration.access_token;
}

async function logApiCall(
  supabaseClient: any, 
  userId: string, 
  companyId: string, 
  endpoint: string, 
  method: string, 
  statusCode: number, 
  responseTime: number, 
  error?: string,
  apiService?: string
) {
  await supabaseClient
    .from('hubspot_api_logs')
    .insert({
      user_id: userId,
      company_id: companyId,
      api_service: apiService || 'unknown',
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
      error_message: error,
    });
}

async function cacheEntity(
  supabaseClient: any, 
  entityType: string, 
  data: any, 
  userId: string, 
  companyId: string
) {
  try {
    switch (entityType) {
      case 'contacts':
        if (Array.isArray(data)) {
          const contactsToCache = data.map((contact: any) => ({
            user_id: userId,
            company_id: companyId,
            hubspot_contact_id: contact.id,
            email: contact.properties.email,
            first_name: contact.properties.firstname,
            last_name: contact.properties.lastname,
            phone: contact.properties.phone,
            company_name: contact.properties.company,
            job_title: contact.properties.jobtitle,
            lifecycle_stage: contact.properties.lifecyclestage,
            lead_status: contact.properties.hs_lead_status,
            properties: contact.properties,
            created_at: contact.createdAt,
            updated_at: contact.updatedAt,
            synced_at: new Date().toISOString(),
          }));

          await supabaseClient
            .from('hubspot_contacts')
            .upsert(contactsToCache, { onConflict: 'user_id,hubspot_contact_id' });
        } else {
          // Single contact
          const contactToCache = {
            user_id: userId,
            company_id: companyId,
            hubspot_contact_id: data.id,
            email: data.properties.email,
            first_name: data.properties.firstname,
            last_name: data.properties.lastname,
            phone: data.properties.phone,
            company_name: data.properties.company,
            job_title: data.properties.jobtitle,
            lifecycle_stage: data.properties.lifecyclestage,
            lead_status: data.properties.hs_lead_status,
            properties: data.properties,
            created_at: data.createdAt,
            updated_at: data.updatedAt,
            synced_at: new Date().toISOString(),
          };

          await supabaseClient
            .from('hubspot_contacts')
            .upsert(contactToCache, { onConflict: 'user_id,hubspot_contact_id' });
        }
        break;

      case 'companies':
        if (Array.isArray(data)) {
          const companiesToCache = data.map((company: any) => ({
            user_id: userId,
            company_id: companyId,
            hubspot_company_id: company.id,
            name: company.properties.name,
            domain: company.properties.domain,
            industry: company.properties.industry,
            city: company.properties.city,
            state: company.properties.state,
            country: company.properties.country,
            phone: company.properties.phone,
            properties: company.properties,
            created_at: company.createdAt,
            updated_at: company.updatedAt,
            synced_at: new Date().toISOString(),
          }));

          await supabaseClient
            .from('hubspot_companies')
            .upsert(companiesToCache, { onConflict: 'user_id,hubspot_company_id' });
        } else {
          // Single company
          const companyToCache = {
            user_id: userId,
            company_id: companyId,
            hubspot_company_id: data.id,
            name: data.properties.name,
            domain: data.properties.domain,
            industry: data.properties.industry,
            city: data.properties.city,
            state: data.properties.state,
            country: data.properties.country,
            phone: data.properties.phone,
            properties: data.properties,
            created_at: data.createdAt,
            updated_at: data.updatedAt,
            synced_at: new Date().toISOString(),
          };

          await supabaseClient
            .from('hubspot_companies')
            .upsert(companyToCache, { onConflict: 'user_id,hubspot_company_id' });
        }
        break;

      case 'deals':
        if (Array.isArray(data)) {
          const dealsToCache = data.map((deal: any) => ({
            user_id: userId,
            company_id: companyId,
            hubspot_deal_id: deal.id,
            deal_name: deal.properties.dealname,
            deal_stage: deal.properties.dealstage,
            amount: deal.properties.amount ? parseFloat(deal.properties.amount) : null,
            currency: deal.properties.currency,
            close_date: deal.properties.closedate,
            deal_type: deal.properties.dealtype,
            properties: deal.properties,
            created_at: deal.createdAt,
            updated_at: deal.updatedAt,
            synced_at: new Date().toISOString(),
          }));

          await supabaseClient
            .from('hubspot_deals')
            .upsert(dealsToCache, { onConflict: 'user_id,hubspot_deal_id' });
        } else {
          // Single deal
          const dealToCache = {
            user_id: userId,
            company_id: companyId,
            hubspot_deal_id: data.id,
            deal_name: data.properties.dealname,
            deal_stage: data.properties.dealstage,
            amount: data.properties.amount ? parseFloat(data.properties.amount) : null,
            currency: data.properties.currency,
            close_date: data.properties.closedate,
            deal_type: data.properties.dealtype,
            properties: data.properties,
            created_at: data.createdAt,
            updated_at: data.updatedAt,
            synced_at: new Date().toISOString(),
          };

          await supabaseClient
            .from('hubspot_deals')
            .upsert(dealToCache, { onConflict: 'user_id,hubspot_deal_id' });
        }
        break;
    }
    console.log(`Cached ${entityType} to database`);
  } catch (cacheError) {
    console.error(`Failed to cache ${entityType}:`, cacheError);
  }
}

async function executeHubSpotOperation(
  operation: string, 
  parameters: any, 
  supabaseClient: any, 
  userId: string, 
  companyId: string
) {
  const startTime = Date.now();
  const requiredService = SERVICE_PERMISSIONS[operation as keyof typeof SERVICE_PERMISSIONS];
  
  if (!requiredService) {
    throw new Error(`Unknown operation: ${operation}`);
  }

  const accessToken = await getValidAccessToken(supabaseClient, userId, requiredService);
  const apiService = operation.split('_')[1]; // contacts, companies, deals, tickets

  let hubspotResponse: Response;
  let endpoint: string;
  let method: string;
  let requestBody: any;

  switch (operation) {
    case 'search_contacts':
      endpoint = 'contacts/search';
      method = 'POST';
      requestBody = {
        limit: parameters.limit || 10,
        properties: parameters.properties || ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle'],
        filterGroups: []
      };

      if (parameters.query) {
        requestBody.filterGroups = [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'CONTAINS_TOKEN',
                value: parameters.query
              }
            ]
          }
        ];
      }

      if (parameters.filterGroups && parameters.filterGroups.length > 0) {
        requestBody.filterGroups = [...requestBody.filterGroups, ...parameters.filterGroups];
      }

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'create_contact':
      endpoint = 'contacts';
      method = 'POST';
      requestBody = {
        properties: {
          email: parameters.email,
          ...(parameters.first_name && { firstname: parameters.first_name }),
          ...(parameters.last_name && { lastname: parameters.last_name }),
          ...(parameters.phone && { phone: parameters.phone }),
          ...(parameters.company && { company: parameters.company }),
          ...(parameters.job_title && { jobtitle: parameters.job_title }),
          ...parameters.properties
        }
      };

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'update_contact':
      endpoint = `contacts/${parameters.contact_id}`;
      method = 'PATCH';
      requestBody = {
        properties: parameters.properties
      };

      hubspotResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${parameters.contact_id}`, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'search_companies':
      endpoint = 'companies/search';
      method = 'POST';
      requestBody = {
        limit: parameters.limit || 10,
        properties: parameters.properties || ['name', 'domain', 'industry', 'city', 'state', 'country'],
        filterGroups: []
      };

      if (parameters.query) {
        requestBody.filterGroups = [
          {
            filters: [
              {
                propertyName: 'name',
                operator: 'CONTAINS_TOKEN',
                value: parameters.query
              }
            ]
          }
        ];
      }

      if (parameters.filterGroups && parameters.filterGroups.length > 0) {
        requestBody.filterGroups = [...requestBody.filterGroups, ...parameters.filterGroups];
      }

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'create_company':
      endpoint = 'companies';
      method = 'POST';
      requestBody = {
        properties: {
          name: parameters.name,
          ...(parameters.domain && { domain: parameters.domain }),
          ...(parameters.industry && { industry: parameters.industry }),
          ...(parameters.city && { city: parameters.city }),
          ...(parameters.state && { state: parameters.state }),
          ...(parameters.country && { country: parameters.country }),
          ...(parameters.phone && { phone: parameters.phone }),
          ...parameters.properties
        }
      };

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'search_deals':
      endpoint = 'deals/search';
      method = 'POST';
      requestBody = {
        limit: parameters.limit || 10,
        properties: parameters.properties || ['dealname', 'dealstage', 'amount', 'closedate', 'dealtype', 'pipeline'],
        filterGroups: []
      };

      if (parameters.query) {
        requestBody.filterGroups = [
          {
            filters: [
              {
                propertyName: 'dealname',
                operator: 'CONTAINS_TOKEN',
                value: parameters.query
              }
            ]
          }
        ];
      }

      if (parameters.filterGroups && parameters.filterGroups.length > 0) {
        requestBody.filterGroups = [...requestBody.filterGroups, ...parameters.filterGroups];
      }

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'create_deal':
      endpoint = 'deals';
      method = 'POST';
      requestBody = {
        properties: {
          dealname: parameters.deal_name,
          ...(parameters.deal_stage && { dealstage: parameters.deal_stage }),
          ...(parameters.amount && { amount: parameters.amount }),
          ...(parameters.currency && { currency: parameters.currency }),
          ...(parameters.close_date && { closedate: parameters.close_date }),
          ...(parameters.deal_type && { dealtype: parameters.deal_type }),
          ...parameters.properties
        }
      };

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'update_deal':
      endpoint = `deals/${parameters.deal_id}`;
      method = 'PATCH';
      requestBody = {
        properties: parameters.properties
      };

      hubspotResponse = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${parameters.deal_id}`, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'search_tickets':
      endpoint = 'tickets/search';
      method = 'POST';
      requestBody = {
        limit: parameters.limit || 10,
        properties: parameters.properties || ['subject', 'content', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_priority', 'hs_ticket_category'],
        filterGroups: []
      };

      if (parameters.query) {
        requestBody.filterGroups = [
          {
            filters: [
              {
                propertyName: 'subject',
                operator: 'CONTAINS_TOKEN',
                value: parameters.query
              }
            ]
          }
        ];
      }

      if (parameters.filterGroups && parameters.filterGroups.length > 0) {
        requestBody.filterGroups = [...requestBody.filterGroups, ...parameters.filterGroups];
      }

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tickets/search', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    case 'create_ticket':
      endpoint = 'tickets';
      method = 'POST';
      requestBody = {
        properties: {
          subject: parameters.subject,
          ...(parameters.content && { content: parameters.content }),
          ...(parameters.priority && { hs_ticket_priority: parameters.priority }),
          ...(parameters.category && { hs_ticket_category: parameters.category }),
          ...(parameters.hs_pipeline && { hs_pipeline: parameters.hs_pipeline }),
          ...(parameters.hs_pipeline_stage && { hs_pipeline_stage: parameters.hs_pipeline_stage }),
          ...parameters.properties
        }
      };

      hubspotResponse = await fetch('https://api.hubapi.com/crm/v3/objects/tickets', {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      break;

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  const responseTime = Date.now() - startTime;

  if (!hubspotResponse.ok) {
    const error = await hubspotResponse.text();
    console.error(`HubSpot ${operation} API error:`, error);
    
    await logApiCall(supabaseClient, userId, companyId, endpoint, method, hubspotResponse.status, responseTime, error, apiService);
    
    throw new Error(`HubSpot ${operation} failed: ${hubspotResponse.status} ${error}`);
  }

  const data = await hubspotResponse.json();
  
  await logApiCall(supabaseClient, userId, companyId, endpoint, method, 200, responseTime, undefined, apiService);

  // Cache the data if it's a search or create operation
  if (operation.includes('search') && data.results && data.results.length > 0) {
    await cacheEntity(supabaseClient, apiService, data.results, userId, companyId);
  } else if (operation.includes('create') && data.id) {
    await cacheEntity(supabaseClient, apiService, data, userId, companyId);
  }

  return data;
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

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const { action, operation, parameters } = await req.json();

    if (action === 'list_operations') {
      // Return available operations
      return new Response(JSON.stringify({ operations: HUBSPOT_OPERATIONS }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'execute_operation') {
      if (!operation || !parameters) {
        return new Response(JSON.stringify({ error: 'Operation and parameters required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate operation exists
      if (!HUBSPOT_OPERATIONS.includes(operation)) {
        return new Response(JSON.stringify({ error: `Unknown operation: ${operation}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user has the required HubSpot integration
      const requiredService = SERVICE_PERMISSIONS[operation as keyof typeof SERVICE_PERMISSIONS];
      const { data: integration } = await supabaseClient
        .from('hubspot_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq(requiredService, true)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ 
          error: `HubSpot ${requiredService.replace('_enabled', '')} integration not found. Please connect your HubSpot account and enable ${requiredService.replace('_enabled', '')} access.` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeHubSpotOperation(operation, parameters, supabaseClient, user.id, profile?.company_id || null);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('HubSpot operations error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



