import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ToolExecutionRequest {
  agentId: string;
  toolId: string;
  action: string;
  parameters: Record<string, any>;
}

interface ToolExecutionResponse {
  success: boolean;
  tool_id: string;
  results: any;
  summary: string;
  metadata: {
    execution_time: number;
    api_calls: number;
  };
}

// HubSpot tool implementations
async function executeHubSpotTool(
  toolId: string, 
  action: string, 
  parameters: Record<string, any>,
  supabaseClient: any
): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Map tool IDs to operations
    const toolToOperationMap: { [key: string]: string } = {
      'hubspot_contacts_search': 'search_contacts',
      'hubspot_contacts_create': 'create_contact',
      'hubspot_contacts_update': 'update_contact',
      'hubspot_companies_search': 'search_companies',
      'hubspot_companies_create': 'create_company',
      'hubspot_deals_search': 'search_deals',
      'hubspot_deals_create': 'create_deal',
      'hubspot_deals_update': 'update_deal',
      'hubspot_tickets_search': 'search_tickets',
      'hubspot_tickets_create': 'create_ticket'
    };

    const operation = toolToOperationMap[toolId];
    if (!operation) {
      throw new Error(`Unknown HubSpot tool: ${toolId}`);
    }

    // Call the unified hubspot-operations function
    const { data, error } = await supabaseClient.functions.invoke('hubspot-operations', {
      body: {
        action: 'execute_operation',
        operation: operation,
        parameters: parameters
      }
    });
    
    if (error) throw error;
    
    const result = data.result;
    
    // Generate summary based on operation type
    let summary: string;
    switch (operation) {
      case 'search_contacts':
        summary = `Found ${result?.results?.length || 0} HubSpot contacts matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_contact':
        summary = `Successfully created HubSpot contact: ${parameters.email}`;
        break;
      case 'update_contact':
        summary = `Successfully updated HubSpot contact: ${parameters.contact_id}`;
        break;
      case 'search_companies':
        summary = `Found ${result?.results?.length || 0} HubSpot companies matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_company':
        summary = `Successfully created HubSpot company: ${parameters.name}`;
        break;
      case 'search_deals':
        summary = `Found ${result?.results?.length || 0} HubSpot deals matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_deal':
        summary = `Successfully created HubSpot deal: ${parameters.deal_name}`;
        break;
      case 'update_deal':
        summary = `Successfully updated HubSpot deal: ${parameters.deal_id}`;
        break;
      case 'search_tickets':
        summary = `Found ${result?.results?.length || 0} HubSpot tickets matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_ticket':
        summary = `Successfully created HubSpot ticket: ${parameters.subject}`;
        break;
      default:
        summary = `Successfully executed HubSpot operation: ${operation}`;
    }
    
    return {
      success: true,
      tool_id: toolId,
      results: result,
      summary: summary,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 1
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      tool_id: toolId,
      results: null,
      summary: `Error executing HubSpot tool ${toolId}: ${errorMessage}`,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 0
      }
    };
  }
}

// OpenAI tool implementations
async function executeOpenAITool(
  toolId: string, 
  action: string, 
  parameters: Record<string, any>,
  supabaseClient: any,
  agentConfig?: { ai_provider: string; ai_model: string }
): Promise<any> {
  const startTime = Date.now();
  
  try {
    switch (toolId) {
      case 'openai_image_generation':
        if (action === 'generate' || action === 'create') {
          const { data, error } = await supabaseClient.functions.invoke('openai-image-generation', {
            body: { 
              prompt: parameters.prompt,
              size: parameters.size || '1024x1024',
              quality: parameters.quality || 'standard',
              n: parameters.n || 1,
              ai_provider: agentConfig?.ai_provider || 'openai',
              ai_model: agentConfig?.ai_model || 'gpt-image-1'
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Generated ${data?.images?.length || 0} image(s) for prompt: "${parameters.prompt?.substring(0, 50)}..."`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1,
              content_type: 'image_generation'
            }
          };
        }
        break;

      case 'openai_web_research':
        if (action === 'research') {
          console.log('🔍 [WEB RESEARCH] Starting Perplexity-powered web research');
          console.log('🔍 [WEB RESEARCH] Query:', parameters.query);
          console.log('🔍 [WEB RESEARCH] Depth:', parameters.depth || 'detailed');
          console.log('🔍 [WEB RESEARCH] Focus areas:', parameters.focus_areas || []);
          console.log('🔍 [WEB RESEARCH] Include sources:', parameters.include_sources !== false);
          
          const requestBody = { 
            query: parameters.query,
            focus_areas: parameters.focus_areas || [],
            depth: parameters.depth || 'detailed',
            include_sources: parameters.include_sources !== false
            // Note: Perplexity uses its own models, so we don't pass ai_provider or ai_model
          };
          
          console.log('🔍 [WEB RESEARCH] Calling openai-web-research with body:', JSON.stringify(requestBody, null, 2));
          
          const { data, error } = await supabaseClient.functions.invoke('openai-web-research', {
            body: requestBody
          });
          
          if (error) {
            console.error('🔍 [WEB RESEARCH] Error from openai-web-research:', error);
            throw error;
          }
          
          console.log('🔍 [WEB RESEARCH] Received response from Perplexity');
          console.log('🔍 [WEB RESEARCH] Research success:', data?.success);
          console.log('🔍 [WEB RESEARCH] Model used:', data?.metadata?.model);
          console.log('🔍 [WEB RESEARCH] Execution time:', data?.metadata?.execution_time);
          console.log('🔍 [WEB RESEARCH] Sources found:', data?.research?.total_sources || 0);
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Completed ${data?.metadata?.depth || 'detailed'} research on: "${parameters.query?.substring(0, 50)}..." using Perplexity (${data?.research?.total_sources || 0} sources)`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1,
              content_type: 'web_research',
              perplexity_model: data?.metadata?.model,
              sources_count: data?.research?.total_sources || 0
            }
          };
        }
        break;

      default:
        throw new Error(`Unknown OpenAI tool: ${toolId}`);
    }
    
    throw new Error(`Unsupported action "${action}" for OpenAI tool "${toolId}"`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      tool_id: toolId,
      results: null,
      summary: `Error executing OpenAI tool ${toolId}: ${errorMessage}`,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 0,
        content_type: 'error'
      }
    };
  }
}

// GSuite tool implementations
async function executeGSuiteTool(
  toolId: string, 
  action: string, 
  parameters: Record<string, any>,
  supabaseClient: any
): Promise<any> {
  const startTime = Date.now();
  
  try {
    switch (toolId) {
      case 'gmail_search':
        if (action === 'search') {
          const { data, error } = await supabaseClient.functions.invoke('gmail-list-messages', {
            body: { 
              query: parameters.query,
              maxResults: parameters.maxResults || 10
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Found ${data?.messages?.length || 0} Gmail messages matching "${parameters.query}"`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'drive_search':
        if (action === 'search') {
          const { data, error } = await supabaseClient.functions.invoke('drive-list-files', {
            body: { 
              query: parameters.query,
              maxResults: parameters.maxResults || 10,
              fileType: parameters.fileType
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Found ${data?.files?.length || 0} Drive files matching "${parameters.query}"`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'docs_read':
        if (action === 'read') {
          const { data, error } = await supabaseClient.functions.invoke('docs-read-content', {
            body: { 
              documentId: parameters.documentId
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Successfully read Google Document: ${parameters.documentId}`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'sheets_read':
        if (action === 'read') {
          const { data, error } = await supabaseClient.functions.invoke('sheets-read-data', {
            body: { 
              spreadsheetId: parameters.spreadsheetId,
              range: parameters.range
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Successfully read Google Sheets data from ${parameters.spreadsheetId}`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'calendar_list_events':
        if (action === 'list' || action === 'search') {
          // Ensure dates are in proper RFC3339 format with timezone
          let formattedTimeMin = parameters.timeMin;
          let formattedTimeMax = parameters.timeMax;
          
          if (formattedTimeMin && !formattedTimeMin.includes('T')) {
            formattedTimeMin = `${formattedTimeMin}T00:00:00Z`;
          } else if (formattedTimeMin && !formattedTimeMin.endsWith('Z') && !formattedTimeMin.includes('+')) {
            formattedTimeMin = `${formattedTimeMin}Z`;
          }
          
          if (formattedTimeMax && !formattedTimeMax.includes('T')) {
            formattedTimeMax = `${formattedTimeMax}T23:59:59Z`;
          } else if (formattedTimeMax && !formattedTimeMax.endsWith('Z') && !formattedTimeMax.includes('+')) {
            formattedTimeMax = `${formattedTimeMax}Z`;
          }

          const { data, error } = await supabaseClient.functions.invoke('calendar-list-events', {
            body: { 
              calendarId: parameters.calendarId || 'primary',
              timeMin: formattedTimeMin,
              timeMax: formattedTimeMax,
              maxResults: parameters.maxResults || 10,
              query: parameters.query
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Found ${data?.items?.length || 0} calendar events`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'calendar_create_event':
        if (action === 'create') {
          // Map AI agent parameters to calendar function parameters
          const summary = parameters.title || parameters.summary;
          const start = parameters.start_time || parameters.start;
          const end = parameters.end_time || parameters.end;
          
          const { data, error } = await supabaseClient.functions.invoke('calendar-create-event', {
            body: { 
              calendarId: parameters.calendarId || 'primary',
              summary,
              description: parameters.description,
              start,
              end,
              location: parameters.location,
              attendees: parameters.attendees
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Successfully created calendar event: ${summary}`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'calendar_update_event':
        if (action === 'update') {
          // Map AI agent parameters to calendar function parameters
          const summary = parameters.title || parameters.summary;
          const start = parameters.start_time || parameters.start;
          const end = parameters.end_time || parameters.end;
          
          const { data, error } = await supabaseClient.functions.invoke('calendar-update-event', {
            body: { 
              calendarId: parameters.calendarId || 'primary',
              eventId: parameters.eventId,
              summary,
              description: parameters.description,
              start,
              end,
              location: parameters.location,
              attendees: parameters.attendees
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Successfully updated calendar event: ${parameters.eventId}`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      case 'calendar_delete_event':
        if (action === 'delete') {
          const { data, error } = await supabaseClient.functions.invoke('calendar-delete-event', {
            body: { 
              calendarId: parameters.calendarId || 'primary',
              eventId: parameters.eventId,
              sendUpdates: parameters.sendUpdates || 'all'
            }
          });
          
          if (error) throw error;
          
          return {
            success: true,
            tool_id: toolId,
            results: data,
            summary: `Successfully deleted calendar event: ${parameters.eventId}`,
            metadata: {
              execution_time: Date.now() - startTime,
              api_calls: 1
            }
          };
        }
        break;

      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }
    
    throw new Error(`Unsupported action "${action}" for tool "${toolId}"`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      tool_id: toolId,
      results: null,
      summary: `Error executing ${toolId}: ${errorMessage}`,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 0
      }
    };
  }
}

// QuickBooks tool implementations
async function executeQuickBooksTool(
  toolId: string, 
  action: string, 
  parameters: Record<string, any>,
  supabaseClient: any
): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Map tool IDs to operations
    const toolToOperationMap: { [key: string]: string } = {
      'quickbooks_customers_search': 'search_customers',
      'quickbooks_customers_create': 'create_customer',
      'quickbooks_invoices_search': 'search_invoices',
      'quickbooks_invoices_create': 'create_invoice',
      'quickbooks_payments_search': 'search_payments',
      'quickbooks_payments_create': 'create_payment',
      'quickbooks_items_search': 'search_items',
      'quickbooks_items_create': 'create_item',
      'quickbooks_accounts_search': 'search_accounts'
    };

    const operation = toolToOperationMap[toolId];
    if (!operation) {
      throw new Error(`Unknown QuickBooks tool: ${toolId}`);
    }

    // Call the unified quickbooks-operations function
    const { data, error } = await supabaseClient.functions.invoke('quickbooks-operations', {
      body: {
        operation: operation,
        parameters: parameters
      }
    });
    
    if (error) throw error;
    
    const result = data.result;
    
    // Generate summary based on operation type
    let summary: string;
    switch (operation) {
      case 'search_customers':
        summary = `Found ${result?.customers?.length || 0} QuickBooks customers matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_customer':
        summary = `Successfully created QuickBooks customer: ${parameters.name}`;
        break;
      case 'search_invoices':
        summary = `Found ${result?.invoices?.length || 0} QuickBooks invoices matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_invoice':
        summary = `Successfully created QuickBooks invoice`;
        break;
      case 'search_payments':
        summary = `Found ${result?.payments?.length || 0} QuickBooks payments matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_payment':
        summary = `Successfully created QuickBooks payment: $${parameters.amount}`;
        break;
      case 'search_items':
        summary = `Found ${result?.items?.length || 0} QuickBooks items matching "${parameters.query || 'criteria'}"`;
        break;
      case 'create_item':
        summary = `Successfully created QuickBooks item: ${parameters.name}`;
        break;
      case 'search_accounts':
        summary = `Found ${result?.accounts?.length || 0} QuickBooks accounts matching "${parameters.query || 'criteria'}"`;
        break;
      default:
        summary = `Successfully executed QuickBooks operation: ${operation}`;
    }
    
    return {
      success: true,
      tool_id: toolId,
      results: result,
      summary: summary,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 1
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      tool_id: toolId,
      results: null,
      summary: `Error executing QuickBooks tool ${toolId}: ${errorMessage}`,
      metadata: {
        execution_time: Date.now() - startTime,
        api_calls: 0
      }
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { agentId, toolId, action, parameters }: ToolExecutionRequest = await req.json();

    console.log(`Executing tool: ${toolId}, action: ${action}, parameters:`, JSON.stringify(parameters, null, 2));

    // Verify agent has access to this tool
    console.log(`Verifying tool access for agent ${agentId} and tool ${toolId}`);
    
    const { data: agentTool, error: toolError } = await supabaseClient
      .from('agent_tools')
      .select(`
        tool_id,
        is_enabled,
        configuration,
        tools!inner (
          id,
          name,
          tool_type,
          schema_definition
        )
      `)
      .eq('agent_id', agentId)
      .eq('tool_id', toolId)
      .eq('is_enabled', true)
      .single();

    console.log('Tool verification result:', { agentTool, toolError });

    if (toolError || !agentTool) {
      console.error('Tool access denied:', {
        agentId,
        toolId,
        error: toolError,
        agentTool
      });
      return new Response(JSON.stringify({ 
        error: 'Agent does not have access to this tool or tool is not enabled',
        details: {
          agentId,
          toolId,
          error: toolError?.message,
          hasAccess: !!agentTool
        }
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tool = (agentTool.tools as any) || agentTool.tools;
    console.log('Tool details:', tool);

    // Add defensive check for tool name
    if (!tool || !tool.name) {
      console.error('Tool data is incomplete:', { tool, agentTool });
      return new Response(JSON.stringify({ 
        error: 'Tool configuration is incomplete',
        details: { toolId, tool }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch agent configuration for provider-specific tool execution
    const { data: agentData } = await supabaseClient
      .from('agents')
      .select('configuration')
      .eq('id', agentId)
      .single();

    const agentConfig = {
      ai_provider: agentData?.configuration?.ai_provider || 'openai',
      ai_model: agentData?.configuration?.ai_model || 'gpt-4o'
    };

    console.log('Agent configuration:', agentConfig);

    // Route to appropriate tool executor based on tool type
    let result: ToolExecutionResponse;
    
    switch (tool.tool_type) {
      case 'openai':
        // For OpenAI tools, use the tool name instead of UUID for the execution
        result = await executeOpenAITool(tool.name, action, parameters, supabaseClient, agentConfig);
        break;
      
      case 'gsuite':
        // For GSuite tools, use the tool name instead of UUID for the execution
        result = await executeGSuiteTool(tool.name, action, parameters, supabaseClient);
        break;
      
      case 'hubspot':
        // For HubSpot tools, use the tool name instead of UUID for the execution
        result = await executeHubSpotTool(tool.name, action, parameters, supabaseClient);
        break;
      
      case 'quickbooks':
        // For QuickBooks tools, use the tool name instead of UUID for the execution
        result = await executeQuickBooksTool(tool.name, action, parameters, supabaseClient);
        break;
      
      default:
        throw new Error(`Unsupported tool type: ${tool.tool_type}`);
    }

    console.log(`Tool execution result:`, JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in agent-tools-executor:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});