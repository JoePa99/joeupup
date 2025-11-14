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

// G Suite tools definitions
const GSUITE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gmail_messages",
      description: "Search Gmail messages for relevant information. Use this when the user asks about emails, messages, or communication history.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Gmail search query using Gmail search operators (e.g., 'from:example@gmail.com subject:important', 'after:2024/01/01 label:important')"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of messages to return (default: 10)",
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
      name: "search_drive_files",
      description: "Search Google Drive files and folders. Use this when the user asks about documents, files, or shared content.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for file names or content"
          },
          mimeType: {
            type: "string",
            description: "Filter by specific MIME type (e.g., 'application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet')"
          },
          folderId: {
            type: "string",
            description: "Search within a specific folder"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_google_doc",
      description: "Read content from a Google Document. Use this when you need to analyze or reference the content of a specific document.",
      parameters: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            description: "The Google Document ID (can be extracted from Drive search results)"
          }
        },
        required: ["documentId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_google_sheet",
      description: "Read data from a Google Spreadsheet. Use this when you need to analyze spreadsheet data or answer questions about tabular information.",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "The Google Spreadsheet ID (can be extracted from Drive search results)"
          },
          range: {
            type: "string",
            description: "Cell range to read (e.g., 'Sheet1!A1:C10')",
            default: "A1:Z1000"
          }
        },
        required: ["spreadsheetId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List Google Calendar events. Use this when the user asks about their schedule, meetings, appointments, or calendar events.",
      parameters: {
        type: "object",
        properties: {
          calendarId: {
            type: "string",
            description: "Calendar ID (default: 'primary')",
            default: "primary"
          },
          timeMin: {
            type: "string",
            description: "Start time (ISO 8601 format, e.g., '2024-01-01T00:00:00Z')"
          },
          timeMax: {
            type: "string",
            description: "End time (ISO 8601 format, e.g., '2024-01-31T23:59:59Z')"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of events to return (default: 10)",
            default: 10
          },
          query: {
            type: "string",
            description: "Search query for event titles"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new Google Calendar event. Use this when the user asks to schedule meetings, appointments, or add events to their calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Event title/summary"
          },
          description: {
            type: "string",
            description: "Event description"
          },
          start: {
            type: "object",
            description: "Event start time (e.g., {dateTime: '2024-01-01T10:00:00Z', timeZone: 'UTC'})"
          },
          end: {
            type: "object",
            description: "Event end time (e.g., {dateTime: '2024-01-01T11:00:00Z', timeZone: 'UTC'})"
          },
          location: {
            type: "string",
            description: "Event location"
          },
          attendees: {
            type: "array",
            description: "List of attendee email addresses"
          },
          calendarId: {
            type: "string",
            description: "Calendar ID (default: 'primary')",
            default: "primary"
          }
        },
        required: ["summary", "start", "end"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Update an existing Google Calendar event. Use this when the user wants to modify event details, reschedule, or update attendees.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID (can be obtained from list_calendar_events)"
          },
          summary: {
            type: "string",
            description: "Event title/summary"
          },
          description: {
            type: "string",
            description: "Event description"
          },
          start: {
            type: "object",
            description: "Event start time"
          },
          end: {
            type: "object",
            description: "Event end time"
          },
          location: {
            type: "string",
            description: "Event location"
          },
          attendees: {
            type: "array",
            description: "List of attendee email addresses"
          },
          calendarId: {
            type: "string",
            description: "Calendar ID (default: 'primary')",
            default: "primary"
          }
        },
        required: ["eventId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Delete a Google Calendar event. Use this when the user wants to cancel or remove an event from their calendar.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID (can be obtained from list_calendar_events)"
          },
          calendarId: {
            type: "string",
            description: "Calendar ID (default: 'primary')",
            default: "primary"
          },
          sendUpdates: {
            type: "string",
            description: "Whether to send notifications (all, externalOnly, none)",
            enum: ["all", "externalOnly", "none"],
            default: "all"
          }
        },
        required: ["eventId"]
      }
    }
  }
];

async function executeGSuiteTool(toolCall: any, supabaseClient: any, userId: string) {
  const { name, arguments: args } = toolCall.function;
  const parameters = JSON.parse(args);
  
  console.log(`Executing G Suite tool: ${name}`, parameters);

  switch (name) {
    case 'search_gmail_messages':
      const gmailResponse = await supabaseClient.functions.invoke('gmail-list-messages', {
        body: {
          query: parameters.query,
          maxResults: parameters.maxResults || 10
        }
      });
      
      if (gmailResponse.error) {
        return `Gmail search failed: ${gmailResponse.error.message}`;
      }
      
      const messages = gmailResponse.data.messageDetails || [];
      if (messages.length === 0) {
        return "No Gmail messages found matching your search criteria.";
      }
      
      return `Found ${messages.length} Gmail messages:\n\n${messages.map((msg: any, index: number) => 
        `${index + 1}. **${msg.subject}**\n   From: ${msg.from}\n   Date: ${msg.date}\n   Snippet: ${msg.snippet}\n`
      ).join('\n')}`;

    case 'search_drive_files':
      const driveResponse = await supabaseClient.functions.invoke('drive-list-files', {
        body: {
          query: parameters.query,
          mimeType: parameters.mimeType,
          folderId: parameters.folderId,
          pageSize: 20
        }
      });
      
      if (driveResponse.error) {
        return `Drive search failed: ${driveResponse.error.message}`;
      }
      
      const files = driveResponse.data.files || [];
      if (files.length === 0) {
        return "No Google Drive files found matching your search criteria.";
      }
      
      return `Found ${files.length} Google Drive files:\n\n${files.map((file: any, index: number) => 
        `${index + 1}. **${file.name}**\n   Type: ${file.mimeType}\n   ID: ${file.id}\n   Modified: ${file.modifiedTime}\n   Link: ${file.webViewLink}\n`
      ).join('\n')}`;

    case 'read_google_doc':
      const docResponse = await supabaseClient.functions.invoke('docs-read-content', {
        body: {
          documentId: parameters.documentId,
          includeFormatting: false
        }
      });
      
      if (docResponse.error) {
        return `Document read failed: ${docResponse.error.message}`;
      }
      
      const docData = docResponse.data;
      return `**Document: ${docData.title}**\n\nContent:\n${docData.textContent}\n\n(Word count: ${docData.metadata.wordCount})`;

    case 'read_google_sheet':
      const sheetResponse = await supabaseClient.functions.invoke('sheets-read-data', {
        body: {
          spreadsheetId: parameters.spreadsheetId,
          range: parameters.range || 'A1:Z1000'
        }
      });
      
      if (sheetResponse.error) {
        return `Sheet read failed: ${sheetResponse.error.message}`;
      }
      
      const sheetData = sheetResponse.data;
      const values = sheetData.values || [];
      
      if (values.length === 0) {
        return "The spreadsheet appears to be empty or the specified range contains no data.";
      }
      
      // Format the data nicely
      const headers = values[0] || [];
      const dataRows = values.slice(1);
      
      let formatted = `**Spreadsheet Data** (${dataRows.length} rows):\n\n`;
      formatted += `Headers: ${headers.join(' | ')}\n\n`;
      
      // Show first few rows
      const previewRows = Math.min(5, dataRows.length);
      for (let i = 0; i < previewRows; i++) {
        const row = dataRows[i] || [];
        formatted += `Row ${i + 1}: ${row.join(' | ')}\n`;
      }
      
      if (dataRows.length > previewRows) {
        formatted += `\n... and ${dataRows.length - previewRows} more rows`;
      }
      
      return formatted;

    case 'list_calendar_events':
      const calendarResponse = await supabaseClient.functions.invoke('calendar-list-events', {
        body: {
          calendarId: parameters.calendarId || 'primary',
          timeMin: parameters.timeMin,
          timeMax: parameters.timeMax,
          maxResults: parameters.maxResults || 10,
          query: parameters.query
        }
      });
      
      if (calendarResponse.error) {
        return `Calendar list failed: ${calendarResponse.error.message}`;
      }
      
      const events = calendarResponse.data.items || [];
      if (events.length === 0) {
        return "No calendar events found matching your criteria.";
      }
      
      return `Found ${events.length} calendar events:\n\n${events.map((event: any, index: number) => 
        `${index + 1}. **${event.summary || 'No title'}**\n   Start: ${event.start?.dateTime || event.start?.date}\n   End: ${event.end?.dateTime || event.end?.date}\n   Location: ${event.location || 'No location'}\n   Status: ${event.status}\n`
      ).join('\n')}`;

    case 'create_calendar_event':
      const createResponse = await supabaseClient.functions.invoke('calendar-create-event', {
        body: {
          calendarId: parameters.calendarId || 'primary',
          summary: parameters.summary,
          description: parameters.description,
          start: parameters.start,
          end: parameters.end,
          location: parameters.location,
          attendees: parameters.attendees
        }
      });
      
      if (createResponse.error) {
        return `Calendar event creation failed: ${createResponse.error.message}`;
      }
      
      const createdEvent = createResponse.data;
      return `✅ Successfully created calendar event: **${createdEvent.summary}**\n\n📅 **Schedule:** ${createdEvent.start?.dateTime || createdEvent.start?.date} to ${createdEvent.end?.dateTime || createdEvent.end?.date}\n📍 **Location:** ${createdEvent.location || 'No location set'}\n🔗 **Event Link:** ${createdEvent.htmlLink}`;

    case 'update_calendar_event':
      const updateResponse = await supabaseClient.functions.invoke('calendar-update-event', {
        body: {
          eventId: parameters.eventId,
          calendarId: parameters.calendarId || 'primary',
          summary: parameters.summary,
          description: parameters.description,
          start: parameters.start,
          end: parameters.end,
          location: parameters.location,
          attendees: parameters.attendees
        }
      });
      
      if (updateResponse.error) {
        return `Calendar event update failed: ${updateResponse.error.message}`;
      }
      
      const updatedEvent = updateResponse.data;
      return `✅ Successfully updated calendar event: **${updatedEvent.summary}**\n\n📅 **New Schedule:** ${updatedEvent.start?.dateTime || updatedEvent.start?.date} to ${updatedEvent.end?.dateTime || updatedEvent.end?.date}\n📍 **Location:** ${updatedEvent.location || 'No location set'}`;

    case 'delete_calendar_event':
      const deleteResponse = await supabaseClient.functions.invoke('calendar-delete-event', {
        body: {
          eventId: parameters.eventId,
          calendarId: parameters.calendarId || 'primary',
          sendUpdates: parameters.sendUpdates || 'all'
        }
      });
      
      if (deleteResponse.error) {
        return `Calendar event deletion failed: ${deleteResponse.error.message}`;
      }
      
      return `✅ Successfully deleted calendar event with ID: ${parameters.eventId}. Notifications were sent to attendees.`;

    default:
      return `Unknown G Suite tool: ${name}`;
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

    // Check if user has Google integration
    const { data: integration } = await supabaseClient
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const hasGoogleIntegration = !!integration;

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

    if (hasGoogleIntegration) {
      systemMessage += `

🔗 **G Suite Integration Available**: You can access the user's Gmail, Google Drive, Google Docs, Google Sheets, and Google Calendar. Use the available tools to search for relevant information when the user asks about:
- Emails, messages, or communication history
- Documents, files, or shared content
- Spreadsheet data or analytics
- Calendar events, meetings, and appointments
- Any content stored in their Google Workspace

Available Google services:
${integration.gmail_enabled ? '✅ Gmail' : '❌ Gmail'}
${integration.drive_enabled ? '✅ Google Drive' : '❌ Google Drive'}
${integration.docs_enabled ? '✅ Google Docs' : '❌ Google Docs'}
${integration.sheets_enabled ? '✅ Google Sheets' : '❌ Google Sheets'}
${integration.calendar_enabled ? '✅ Google Calendar' : '❌ Google Calendar'}`;
    } else {
      systemMessage += `

ℹ️ **G Suite Integration**: Not connected. The user can connect their Google account to enable access to Gmail, Drive, Docs, and Sheets.`;
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
    
    if (hasGoogleIntegration) {
      // Only include tools for enabled services
      GSUITE_TOOLS.forEach(tool => {
        const toolName = tool.function.name;
        if (
          (toolName.includes('gmail') && integration.gmail_enabled) ||
          (toolName.includes('drive') && integration.drive_enabled) ||
          (toolName.includes('doc') && integration.docs_enabled) ||
          (toolName.includes('sheet') && integration.sheets_enabled) ||
          (toolName.includes('calendar') && integration.calendar_enabled)
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
          const result = await executeGSuiteTool(toolCall, supabaseClient, user.id);
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
      hasGoogleIntegration,
      enabledServices: hasGoogleIntegration ? {
        gmail: integration.gmail_enabled,
        drive: integration.drive_enabled,
        docs: integration.docs_enabled,
        sheets: integration.sheets_enabled,
        calendar: integration.calendar_enabled
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Enhanced chat with G Suite error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});