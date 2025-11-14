import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define available G Suite tools for AI agents
const GSUITE_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_gmail_messages",
      description: "Search Gmail messages for relevant information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Gmail search query (e.g., 'from:example@gmail.com subject:important')"
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
      description: "Search Google Drive files and folders",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for file names or content"
          },
          mimeType: {
            type: "string",
            description: "Filter by specific MIME type (e.g., 'application/vnd.google-apps.document')"
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
      description: "Read content from a Google Document",
      parameters: {
        type: "object",
        properties: {
          documentId: {
            type: "string",
            description: "The Google Document ID"
          },
          includeFormatting: {
            type: "boolean",
            description: "Whether to include formatting information",
            default: false
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
      description: "Read data from a Google Spreadsheet",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: {
            type: "string",
            description: "The Google Spreadsheet ID"
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
      name: "create_google_doc",
      description: "Create a new Google Document",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title for the new document"
          },
          content: {
            type: "string",
            description: "Initial content for the document"
          }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_gmail_message",
      description: "Send an email via Gmail",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address"
          },
          subject: {
            type: "string",
            description: "Email subject"
          },
          body: {
            type: "string",
            description: "Email body content"
          },
          cc: {
            type: "string",
            description: "CC email addresses (comma-separated)"
          },
          bcc: {
            type: "string",
            description: "BCC email addresses (comma-separated)"
          }
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List Google Calendar events",
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
            description: "Start time (ISO 8601 format)"
          },
          timeMax: {
            type: "string",
            description: "End time (ISO 8601 format)"
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
      description: "Create a new Google Calendar event",
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
      description: "Update an existing Google Calendar event",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID"
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
      description: "Delete a Google Calendar event",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID"
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

async function executeGSuiteTool(toolName: string, parameters: any, supabaseClient: any, userId: string) {
  console.log(`Executing G Suite tool: ${toolName}`, parameters);

  switch (toolName) {
    case 'search_gmail_messages':
      const gmailResponse = await supabaseClient.functions.invoke('gmail-list-messages', {
        body: {
          query: parameters.query,
          maxResults: parameters.maxResults || 10
        }
      });
      
      if (gmailResponse.error) {
        throw new Error(`Gmail search failed: ${gmailResponse.error.message}`);
      }
      
      return {
        summary: `Found ${gmailResponse.data.messageDetails?.length || 0} messages`,
        messages: gmailResponse.data.messageDetails || []
      };

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
        throw new Error(`Drive search failed: ${driveResponse.error.message}`);
      }
      
      return {
        summary: `Found ${driveResponse.data.files?.length || 0} files`,
        files: driveResponse.data.files || []
      };

    case 'read_google_doc':
      const docResponse = await supabaseClient.functions.invoke('docs-read-content', {
        body: {
          documentId: parameters.documentId,
          includeFormatting: parameters.includeFormatting || false
        }
      });
      
      if (docResponse.error) {
        throw new Error(`Document read failed: ${docResponse.error.message}`);
      }
      
      return {
        title: docResponse.data.title,
        content: docResponse.data.textContent,
        metadata: docResponse.data.metadata
      };

    case 'read_google_sheet':
      const sheetResponse = await supabaseClient.functions.invoke('sheets-read-data', {
        body: {
          spreadsheetId: parameters.spreadsheetId,
          range: parameters.range || 'A1:Z1000'
        }
      });
      
      if (sheetResponse.error) {
        throw new Error(`Sheet read failed: ${sheetResponse.error.message}`);
      }
      
      return {
        values: sheetResponse.data.values || [],
        metadata: sheetResponse.data.metadata
      };

    case 'create_google_doc':
      // This would require a create-doc function (not implemented yet)
      return {
        message: "Document creation functionality coming soon",
        title: parameters.title
      };

    case 'send_gmail_message':
      // This would require a send-email function (not implemented yet)
      return {
        message: "Email sending functionality coming soon",
        to: parameters.to,
        subject: parameters.subject
      };

    case 'list_calendar_events':
      const calendarListResponse = await supabaseClient.functions.invoke('calendar-list-events', {
        body: {
          calendarId: parameters.calendarId || 'primary',
          timeMin: parameters.timeMin,
          timeMax: parameters.timeMax,
          maxResults: parameters.maxResults || 10,
          query: parameters.query
        }
      });
      
      if (calendarListResponse.error) {
        throw new Error(`Calendar list failed: ${calendarListResponse.error.message}`);
      }
      
      return {
        summary: `Found ${calendarListResponse.data.items?.length || 0} calendar events`,
        events: calendarListResponse.data.items || []
      };

    case 'create_calendar_event':
      const calendarCreateResponse = await supabaseClient.functions.invoke('calendar-create-event', {
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
      
      if (calendarCreateResponse.error) {
        throw new Error(`Calendar event creation failed: ${calendarCreateResponse.error.message}`);
      }
      
      return {
        summary: `Created calendar event: ${parameters.summary}`,
        event: calendarCreateResponse.data
      };

    case 'update_calendar_event':
      const calendarUpdateResponse = await supabaseClient.functions.invoke('calendar-update-event', {
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
      
      if (calendarUpdateResponse.error) {
        throw new Error(`Calendar event update failed: ${calendarUpdateResponse.error.message}`);
      }
      
      return {
        summary: `Updated calendar event: ${parameters.eventId}`,
        event: calendarUpdateResponse.data
      };

    case 'delete_calendar_event':
      const calendarDeleteResponse = await supabaseClient.functions.invoke('calendar-delete-event', {
        body: {
          eventId: parameters.eventId,
          calendarId: parameters.calendarId || 'primary',
          sendUpdates: parameters.sendUpdates || 'all'
        }
      });
      
      if (calendarDeleteResponse.error) {
        throw new Error(`Calendar event deletion failed: ${calendarDeleteResponse.error.message}`);
      }
      
      return {
        summary: `Deleted calendar event: ${parameters.eventId}`,
        success: true
      };

    default:
      throw new Error(`Unknown G Suite tool: ${toolName}`);
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
      // Return available G Suite tools for the AI agent
      return new Response(JSON.stringify({ tools: GSUITE_TOOLS }), {
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

      // Check if user has the required G Suite integrations
      const { data: integration } = await supabaseClient
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ 
          error: 'Google integration not found. Please connect your Google account first.' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check specific service permissions
      const servicePermissions = {
        'search_gmail_messages': integration.gmail_enabled,
        'send_gmail_message': integration.gmail_enabled,
        'search_drive_files': integration.drive_enabled,
        'read_google_doc': integration.docs_enabled,
        'create_google_doc': integration.docs_enabled,
        'read_google_sheet': integration.sheets_enabled,
        'list_calendar_events': integration.calendar_enabled,
        'create_calendar_event': integration.calendar_enabled,
        'update_calendar_event': integration.calendar_enabled,
        'delete_calendar_event': integration.calendar_enabled,
      };

      if (!servicePermissions[toolName as keyof typeof servicePermissions]) {
        return new Response(JSON.stringify({ 
          error: `${toolName} requires additional Google permissions. Please reconnect your Google account.` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await executeGSuiteTool(toolName, parameters, supabaseClient, user.id);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('G Suite agent tools error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});