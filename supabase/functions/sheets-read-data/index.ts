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
    .eq('sheets_enabled', true)
    .single();

  if (!integration) {
    throw new Error('Sheets integration not found');
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
      api_service: 'sheets',
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
      spreadsheetId,
      range = 'A1:Z1000', // Default range
      valueRenderOption = 'FORMATTED_VALUE',
      dateTimeRenderOption = 'FORMATTED_STRING'
    } = await req.json();

    if (!spreadsheetId) {
      return new Response(JSON.stringify({ error: 'Spreadsheet ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    // Build Sheets API URL
    const params = new URLSearchParams();
    params.append('valueRenderOption', valueRenderOption);
    params.append('dateTimeRenderOption', dateTimeRenderOption);

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?${params.toString()}`;

    const sheetsResponse = await fetch(sheetsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!sheetsResponse.ok) {
      const error = await sheetsResponse.text();
      console.error('Sheets API error:', error);
      
      if (profile?.company_id) {
        await logApiCall(supabaseClient, user.id, profile.company_id, 'values', 'GET', sheetsResponse.status, responseTime, error);
      }
      
      return new Response(JSON.stringify({ error: 'Failed to read spreadsheet data' }), {
        status: sheetsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sheetsData = await sheetsResponse.json();
    
    if (profile?.company_id) {
      await logApiCall(supabaseClient, user.id, profile.company_id, 'values', 'GET', 200, responseTime);
    }

    // Cache the data in our database for AI processing
    if (sheetsData.values && sheetsData.values.length > 0) {
      const sheetName = range.split('!')[0] || 'Sheet1';
      
      // Cache the sheet data (don't wait for this to complete)
      supabaseClient
        .from('google_sheets_data')
        .upsert({
          user_id: user.id,
          company_id: profile?.company_id,
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          range_notation: range,
          data_values: { values: sheetsData.values, range: sheetsData.range },
          synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,spreadsheet_id,sheet_name,range_notation' })
        .then(() => console.log('Cached sheet data to database'));
    }

    // Enhanced response with metadata
    const response = {
      ...sheetsData,
      metadata: {
        spreadsheetId,
        range,
        rowCount: sheetsData.values?.length || 0,
        columnCount: sheetsData.values?.[0]?.length || 0,
        lastFetched: new Date().toISOString(),
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Sheets read data error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});