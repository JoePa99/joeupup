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
    .eq('gmail_enabled', true)
    .single();

  if (!integration) {
    throw new Error('Gmail integration not found');
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
      api_service: 'gmail',
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
      error_message: error,
    });
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
      query = '', 
      maxResults = 10, 
      labelIds = [], 
      includeSpamTrash = false,
      pageToken = null 
    } = await req.json();

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    // Build Gmail API URL
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    params.append('maxResults', maxResults.toString());
    if (labelIds.length > 0) {
      labelIds.forEach((labelId: string) => params.append('labelIds', labelId));
    }
    params.append('includeSpamTrash', includeSpamTrash.toString());
    if (pageToken) params.append('pageToken', pageToken);

    const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;

    const gmailResponse = await fetch(gmailUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!gmailResponse.ok) {
      const error = await gmailResponse.text();
      console.error('Gmail API error:', error);
      
      if (profile?.company_id) {
        await logApiCall(supabaseClient, user.id, profile.company_id, 'messages', 'GET', gmailResponse.status, responseTime, error);
      }
      
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
        status: gmailResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messagesData = await gmailResponse.json();
    
    if (profile?.company_id) {
      await logApiCall(supabaseClient, user.id, profile.company_id, 'messages', 'GET', 200, responseTime);
    }

    // If we have messages, get their details
    if (messagesData.messages && messagesData.messages.length > 0) {
      const messageDetails = await Promise.all(
        messagesData.messages.slice(0, 5).map(async (msg: any) => {
          try {
            const detailResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              
              // Extract useful information
              const headers = detail.payload?.headers || [];
              const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
              const from = headers.find((h: any) => h.name === 'From')?.value || '';
              const to = headers.find((h: any) => h.name === 'To')?.value || '';
              const date = headers.find((h: any) => h.name === 'Date')?.value || '';

              return {
                id: detail.id,
                threadId: detail.threadId,
                snippet: detail.snippet,
                subject,
                from,
                to,
                date,
                labelIds: detail.labelIds || [],
              };
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch message ${msg.id}:`, error);
            return null;
          }
        })
      );

      messagesData.messageDetails = messageDetails.filter(Boolean);
    }

    return new Response(JSON.stringify(messagesData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Gmail list messages error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});