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
    .eq('drive_enabled', true)
    .single();

  if (!integration) {
    throw new Error('Drive integration not found');
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
      api_service: 'drive',
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
      folderId = null,
      query = '', 
      pageSize = 20, 
      mimeType = null,
      pageToken = null,
      orderBy = 'modifiedTime desc'
    } = await req.json();

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    // Build Drive API query
    let driveQuery = '';
    const queryParts = [];

    if (folderId) {
      queryParts.push(`'${folderId}' in parents`);
    }

    if (query) {
      queryParts.push(`name contains '${query}' or fullText contains '${query}'`);
    }

    if (mimeType) {
      queryParts.push(`mimeType='${mimeType}'`);
    }

    // Exclude trashed files by default
    queryParts.push('trashed=false');

    driveQuery = queryParts.join(' and ');

    // Build API URL
    const params = new URLSearchParams();
    if (driveQuery) params.append('q', driveQuery);
    params.append('pageSize', pageSize.toString());
    params.append('orderBy', orderBy);
    if (pageToken) params.append('pageToken', pageToken);
    
    // Include specific fields we need
    params.append('fields', 'nextPageToken,files(id,name,mimeType,size,parents,createdTime,modifiedTime,webViewLink,thumbnailLink,shared,permissions)');

    const driveUrl = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

    const driveResponse = await fetch(driveUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!driveResponse.ok) {
      const error = await driveResponse.text();
      console.error('Drive API error:', error);
      
      if (profile?.company_id) {
        await logApiCall(supabaseClient, user.id, profile.company_id, 'files', 'GET', driveResponse.status, responseTime, error);
      }
      
      return new Response(JSON.stringify({ error: 'Failed to fetch files' }), {
        status: driveResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filesData = await driveResponse.json();
    
    if (profile?.company_id) {
      await logApiCall(supabaseClient, user.id, profile.company_id, 'files', 'GET', 200, responseTime);
    }

    // Cache the files in our database for future AI processing
    if (filesData.files && filesData.files.length > 0) {
      const filesToCache = filesData.files.map((file: any) => ({
        user_id: user.id,
        company_id: profile?.company_id || null,
        drive_file_id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        file_size: file.size ? parseInt(file.size) : null,
        parent_folder_id: file.parents?.[0] || null,
        web_view_link: file.webViewLink,
        is_shared: file.shared || false,
        created_time: file.createdTime,
        modified_time: file.modifiedTime,
        permissions: file.permissions || {},
        synced_at: new Date().toISOString(),
      }));

      // Upsert files into cache (don't wait for this to complete)
      try {
        await supabaseClient
          .from('google_drive_files')
          .upsert(filesToCache, { onConflict: 'user_id,drive_file_id' });
        console.log('Cached files to database');
      } catch (cacheError) {
        console.error('Failed to cache files:', cacheError);
      }
    }

    return new Response(JSON.stringify(filesData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Drive list files error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});