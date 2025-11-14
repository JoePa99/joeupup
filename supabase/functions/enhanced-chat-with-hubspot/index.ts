import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Fetch conversation history for context
async function fetchConversationHistory(
  supabaseClient: any, 
  conversationId: string, 
  limit: number = 12
) {
  const { data: messages } = await supabaseClient
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
    
  return messages?.map((msg: any) => ({
    role: msg.role,
    content: msg.content
  })) || [];
}

// HubSpot tools definitions (same as hubspot-agent-tools)
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
          }
        },
        required: ["email"]
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
          }
        },
        required: ["query"]
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
          }
        },
        required: ["query"]
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
          }
        },
        required: ["query"]
      }
    }
  }
];

async function executeHubSpotTool(toolCall: any, supabaseClient: any, userId: string) {
  const { name, arguments: args } = toolCall.function;
  const parameters = JSON.parse(args);
  
  console.log(`Executing HubSpot tool: ${name}`, parameters);

  switch (name) {
    case 'search_hubspot_contacts':
      const contactsResponse = await supabaseClient.functions.invoke('hubspot-contacts-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (contactsResponse.error) {
        return `HubSpot contacts search failed: ${contactsResponse.error.message}`;
      }
      
      const contacts = contactsResponse.data.results || [];
      if (contacts.length === 0) {
        return "No HubSpot contacts found matching your search criteria.";
      }
      
      return `Found ${contacts.length} HubSpot contacts:\n\n${contacts.map((contact: any, index: number) => 
        `${index + 1}. **${contact.properties.firstname || ''} ${contact.properties.lastname || ''}**\n   Email: ${contact.properties.email || 'N/A'}\n   Company: ${contact.properties.company || 'N/A'}\n   Phone: ${contact.properties.phone || 'N/A'}\n   Job Title: ${contact.properties.jobtitle || 'N/A'}\n`
      ).join('\n')}`;

    case 'create_hubspot_contact':
      const createContactResponse = await supabaseClient.functions.invoke('hubspot-contacts-create', {
        body: {
          email: parameters.email,
          first_name: parameters.first_name,
          last_name: parameters.last_name,
          phone: parameters.phone,
          company: parameters.company
        }
      });
      
      if (createContactResponse.error) {
        return `HubSpot contact creation failed: ${createContactResponse.error.message}`;
      }
      
      const createdContact = createContactResponse.data;
      return `✅ Successfully created HubSpot contact: **${createdContact.properties.email}**\n\n📧 **Email:** ${createdContact.properties.email}\n👤 **Name:** ${createdContact.properties.firstname || ''} ${createdContact.properties.lastname || ''}\n🏢 **Company:** ${createdContact.properties.company || 'N/A'}\n📞 **Phone:** ${createdContact.properties.phone || 'N/A'}`;

    case 'search_hubspot_companies':
      const companiesResponse = await supabaseClient.functions.invoke('hubspot-companies-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (companiesResponse.error) {
        return `HubSpot companies search failed: ${companiesResponse.error.message}`;
      }
      
      const companies = companiesResponse.data.results || [];
      if (companies.length === 0) {
        return "No HubSpot companies found matching your search criteria.";
      }
      
      return `Found ${companies.length} HubSpot companies:\n\n${companies.map((company: any, index: number) => 
        `${index + 1}. **${company.properties.name || 'N/A'}**\n   Domain: ${company.properties.domain || 'N/A'}\n   Industry: ${company.properties.industry || 'N/A'}\n   Location: ${company.properties.city || 'N/A'}, ${company.properties.state || 'N/A'}\n   Phone: ${company.properties.phone || 'N/A'}\n`
      ).join('\n')}`;

    case 'search_hubspot_deals':
      const dealsResponse = await supabaseClient.functions.invoke('hubspot-deals-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (dealsResponse.error) {
        return `HubSpot deals search failed: ${dealsResponse.error.message}`;
      }
      
      const deals = dealsResponse.data.results || [];
      if (deals.length === 0) {
        return "No HubSpot deals found matching your search criteria.";
      }
      
      return `Found ${deals.length} HubSpot deals:\n\n${deals.map((deal: any, index: number) => 
        `${index + 1}. **${deal.properties.dealname || 'N/A'}**\n   Stage: ${deal.properties.dealstage || 'N/A'}\n   Amount: ${deal.properties.amount ? `$${deal.properties.amount}` : 'N/A'}\n   Close Date: ${deal.properties.closedate || 'N/A'}\n   Deal Type: ${deal.properties.dealtype || 'N/A'}\n`
      ).join('\n')}`;

    case 'search_hubspot_tickets':
      const ticketsResponse = await supabaseClient.functions.invoke('hubspot-tickets-search', {
        body: {
          query: parameters.query,
          limit: parameters.limit || 10
        }
      });
      
      if (ticketsResponse.error) {
        return `HubSpot tickets search failed: ${ticketsResponse.error.message}`;
      }
      
      const tickets = ticketsResponse.data.results || [];
      if (tickets.length === 0) {
        return "No HubSpot tickets found matching your search criteria.";
      }
      
      return `Found ${tickets.length} HubSpot tickets:\n\n${tickets.map((ticket: any, index: number) => 
        `${index + 1}. **${ticket.properties.subject || 'N/A'}**\n   Priority: ${ticket.properties.hs_ticket_priority || 'N/A'}\n   Stage: ${ticket.properties.hs_pipeline_stage || 'N/A'}\n   Category: ${ticket.properties.hs_ticket_category || 'N/A'}\n   Content: ${ticket.properties.content ? ticket.properties.content.substring(0, 100) + '...' : 'N/A'}\n`
      ).join('\n')}`;

    default:
      return `Unknown HubSpot tool: ${name}`;
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

    const { message, conversationId, agentId } = await req.json();

    // Get user's company and profile info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'User company not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user has HubSpot integration
    const { data: integration } = await supabaseClient
      .from('hubspot_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const hasHubSpotIntegration = !!integration;

    // Get or create conversation
    let conversation;
    if (conversationId) {
      const { data: existingConv } = await supabaseClient
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      conversation = existingConv;
    }

    if (!conversation) {
      // Create or get conversation using upsert to prevent duplicates
      try {
        const { data: newConv, error: convError } = await supabaseClient
          .from('chat_conversations')
          .upsert({
            user_id: user.id,
            agent_id: agentId,
            company_id: profile.company_id,
            title: message.substring(0, 50) + '...',
          }, {
            onConflict: 'user_id,agent_id,company_id'
          })
          .select()
          .single();

        if (convError) {
          // Handle unique constraint violation by fetching existing conversation
          if (convError.code === '23505') {
            const { data: existingConv } = await supabaseClient
              .from('chat_conversations')
              .select('*')
              .eq('user_id', user.id)
              .eq('agent_id', agentId)
              .eq('company_id', profile.company_id)
              .single();
            conversation = existingConv;
          } else {
            throw convError;
          }
        } else {
          conversation = newConv;
        }
      } catch (error) {
        console.error('Error creating/getting conversation:', error);
        throw error;
      }
    }

    // Store user message
    await supabaseClient
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      });

    // Get agent information
    const { data: agent } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get relevant documents using agent's vector store instead of custom embedding search
    let documentContext = { data: null };
    
    // Try to get documents from the agent's vector store if available
    try {
      const { data: agentData } = await supabaseClient
        .from('agents')
        .select('vector_store_id, assistant_id')
        .eq('id', agentId)
        .single();

      if (agentData?.vector_store_id) {
        console.log('Agent has vector store configured, documents will be accessible via OpenAI Assistant API');
        // Document search will be handled by the OpenAI Assistant's file_search tool
        // No need for manual vector search here
      }
    } catch (error) {
      console.warn('Could not check agent vector store configuration:', error);
    }

    // Build system message with context
    let systemMessage = agent.configuration?.instructions || 
      `You are ${agent.name}, ${agent.description}.`;
    
    systemMessage += `

User: ${profile.first_name} ${profile.last_name}
Company: ${profile.company_id}

You have access to the company's documents and knowledge base.`;

    if (hasHubSpotIntegration) {
      systemMessage += `

🔗 **HubSpot Integration Available**: You can access the user's HubSpot CRM data including contacts, companies, deals, and tickets. Use the available tools to search for relevant information when the user asks about:
- Contacts, leads, or customer information
- Companies, organizations, or business information  
- Sales deals, opportunities, or revenue
- Support tickets, customer issues, or help requests
- Any CRM data stored in their HubSpot account

Available HubSpot services:
${integration.contacts_enabled ? '✅ Contacts' : '❌ Contacts'}
${integration.companies_enabled ? '✅ Companies' : '❌ Companies'}
${integration.deals_enabled ? '✅ Deals' : '❌ Deals'}
${integration.tickets_enabled ? '✅ Tickets' : '❌ Tickets'}
${integration.workflows_enabled ? '✅ Workflows' : '❌ Workflows'}`;
    } else {
      systemMessage += `

ℹ️ **HubSpot Integration**: Not connected. The user can connect their HubSpot account to enable access to contacts, companies, deals, and tickets.`;
    }

    const documentData = documentContext?.data || [];
    if (documentData && Array.isArray(documentData) && documentData.length > 0) {
      systemMessage += `\n\nRelevant company documents:\n${documentData.map((doc: any) =>
        `- ${doc.file_name}: ${doc.content.substring(0, 200)}...`
      ).join('\n')}`;
    }

    // Fetch conversation history for context (last 12 messages)
    const conversationHistory = conversationId 
      ? await fetchConversationHistory(supabaseClient, conversationId, 12)
      : [];
    
    console.log(`Fetched ${conversationHistory.length} previous messages for enhanced chat context`);

    // Prepare final messages with last 12 conversation messages
    const finalMessages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory,  // Last 12 messages
      { role: 'user', content: message }
    ];

    // Determine which tools to include
    const tools = [];
    
    // Add file search tool if agent has vector store
    try {
      const { data: agentData } = await supabaseClient
        .from('agents')
        .select('vector_store_id')
        .eq('id', agentId)
        .single();

      if (agentData?.vector_store_id) {
        tools.push({ type: 'file_search' });
        console.log('Added file_search tool for document access');
      }
    } catch (error) {
      console.warn('Could not check agent vector store for file search:', error);
    }
    
    if (hasHubSpotIntegration) {
      // Only include tools for enabled services
      HUBSPOT_TOOLS.forEach(tool => {
        const toolName = tool.function.name;
        if (
          (toolName.includes('contacts') && integration.contacts_enabled) ||
          (toolName.includes('companies') && integration.companies_enabled) ||
          (toolName.includes('deals') && integration.deals_enabled) ||
          (toolName.includes('tickets') && integration.tickets_enabled)
        ) {
          tools.push(tool);
        }
      });
    }

    // Make OpenAI request
    const openAIBody: any = {
      model: 'gpt-5-2025-08-07',
      messages: finalMessages,  // Use finalMessages with conversation history
      max_completion_tokens: 1000
    };

    if (tools.length > 0) {
      openAIBody.tools = tools;
      openAIBody.tool_choice = 'auto';
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIBody),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI API error:', error);
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIData = await openAIResponse.json();
    const assistantMessage = openAIData.choices[0].message;

    // Handle tool calls if present
    if (assistantMessage.tool_calls) {
      const toolResults = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        try {
          const result = await executeHubSpotTool(toolCall, supabaseClient, user.id);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: result
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: `Error: ${errorMessage}`
          });
        }
      }

      // Make second OpenAI call with tool results and conversation history
      const followUpMessages = [
        { role: 'system', content: systemMessage },
        ...conversationHistory,  // Include conversation history in follow-up
        { role: 'user', content: message },
        assistantMessage,
        ...toolResults
      ];

      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: followUpMessages,
          max_completion_tokens: 1000
        }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        assistantMessage.content = followUpData.choices[0].message.content;
      }
    }

    // Store assistant response
    await supabaseClient
      .from('chat_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: assistantMessage.content,
      });

    return new Response(JSON.stringify({
      response: assistantMessage.content,
      conversationId: conversation.id,
      hasHubSpotIntegration,
      enabledServices: hasHubSpotIntegration ? {
        contacts: integration.contacts_enabled,
        companies: integration.companies_enabled,
        deals: integration.deals_enabled,
        tickets: integration.tickets_enabled,
        workflows: integration.workflows_enabled
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhanced chat with HubSpot error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



