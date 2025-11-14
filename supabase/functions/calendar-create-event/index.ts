import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getValidAccessToken(supabaseClient: any, userId: string) {
  const { data: integration } = await supabaseClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('calendar_enabled', true)
    .single();

  if (!integration) {
    throw new Error('Google Calendar integration not found');
  }

  // Check if token is expired
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  
  if (expiresAt <= now) {
    // Refresh token
    const refreshResponse = await supabaseClient.functions.invoke('google-refresh-token', {
      body: { userId }
    });
    
    if (refreshResponse.error) {
      throw new Error('Failed to refresh token');
    }
    
    return refreshResponse.data.access_token;
  }

  return integration.access_token;
}

async function logApiCall(supabaseClient: any, userId: string, companyId: string, endpoint: string, method: string, statusCode: number, responseTime: number, error?: string) {
  await supabaseClient
    .from('google_api_logs')
    .insert({
      user_id: userId,
      company_id: companyId,
      api_service: 'calendar',
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
      error_message: error,
    });
}

function normalizeDateTime(dateTime: any, defaultTimeZone = 'UTC') {
  if (typeof dateTime === 'string') {
    // If it's a string, convert to proper Google Calendar format
    return {
      dateTime: dateTime.endsWith('Z') ? dateTime : `${dateTime}Z`,
      timeZone: defaultTimeZone
    };
  }
  // If it's already an object, return as-is
  return dateTime;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
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

    const { 
      calendarId = 'primary',
      summary,
      description,
      start,
      end,
      location,
      attendees,
      conferenceData,
      reminders
    } = await req.json();

    if (!summary || !start || !end) {
      return new Response(JSON.stringify({ error: 'Summary, start, and end are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    // Build event object with normalized date/time
    const event: any = {
      summary,
      start: normalizeDateTime(start),
      end: normalizeDateTime(end)
    };

    if (description) event.description = description;
    if (location) event.location = location;
    if (attendees) event.attendees = attendees;
    if (conferenceData) event.conferenceData = conferenceData;
    if (reminders) event.reminders = reminders;

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const calendarResponse = await fetch(calendarUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    const responseTime = Date.now() - startTime;

    if (!calendarResponse.ok) {
      const error = await calendarResponse.text();
      console.error('Calendar API error:', error);
      
      if (profile?.company_id) {
        await logApiCall(supabaseClient, user.id, profile.company_id, 'events', 'POST', calendarResponse.status, responseTime, error);
      }
      
      return new Response(JSON.stringify({ error: 'Failed to create calendar event' }), {
        status: calendarResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventData = await calendarResponse.json();
    
    if (profile?.company_id) {
      await logApiCall(supabaseClient, user.id, profile.company_id, 'events', 'POST', 201, responseTime);
    }

    return new Response(JSON.stringify(eventData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Calendar create event error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});