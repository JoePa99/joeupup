import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, folderId, maxResults = 5 } = await req.json();
    
    if (!query || !folderId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: query and folderId' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user's Google access token
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('drive_enabled', true)
      .single();

    if (integrationError || !integration) {
      console.log('No Google Drive integration found for user:', user.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Drive not connected' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔍 [GOOGLE-DRIVE] Searching folder:', folderId, 'with query:', query);

    // Build Google Drive search query
    // fullText searches both file names and content
    const driveQuery = `fullText contains '${query}' and '${folderId}' in parents and trashed=false`;
    
    // Execute Google Drive API search
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&pageSize=${maxResults}&orderBy=modifiedTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Google Drive API error:', response.status, response.statusText);
      
      // If token expired, try to refresh
      if (response.status === 401 && integration.refresh_token) {
        console.log('🔑 [GOOGLE-DRIVE] Token expired, attempting refresh...');
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          // Update the access token in database
          await supabase
            .from('google_integrations')
            .update({ access_token: refreshData.access_token })
            .eq('user_id', user.id);

          // Retry the search with new token
          const retryResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&pageSize=${maxResults}&orderBy=modifiedTime desc`,
            {
              headers: {
                'Authorization': `Bearer ${refreshData.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            console.log('🔍 [GOOGLE-DRIVE] Found', retryData.files?.length || 0, 'files after token refresh');
            
            return new Response(JSON.stringify({
              success: true,
              files: retryData.files || [],
              query: query
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Google Drive API error: ${response.status}` 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('🔍 [GOOGLE-DRIVE] Found', data.files?.length || 0, 'files');
    
    return new Response(JSON.stringify({
      success: true,
      files: data.files || [],
      query: query
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in search-google-drive-files:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});










