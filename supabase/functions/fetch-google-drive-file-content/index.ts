import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PDF parsing function (simplified version)
async function parsePdfContent(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // For now, return a placeholder - in production you'd use a proper PDF parser
    // This could be integrated with existing PDF parsing logic from the codebase
    return '[PDF content - parsing not implemented in this demo]';
  } catch (error) {
    console.error('PDF parsing error:', error);
    return '[PDF content could not be parsed]';
  }
}

async function getValidAccessToken(userId: string, supabase: any): Promise<string> {
  const { data: integration, error } = await supabase
    .from('google_integrations')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .eq('drive_enabled', true)
    .single();

  if (error || !integration) {
    throw new Error('Google Drive integration not found');
  }

  // Try to use the current token first
  try {
    const testResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { 'Authorization': `Bearer ${integration.access_token}` }
    });

    if (testResponse.ok) {
      return integration.access_token;
    }
  } catch (error) {
    console.log('Current token invalid, refreshing...');
  }

  // Token is invalid, refresh it
  if (!integration.refresh_token) {
    throw new Error('No refresh token available');
  }

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

  if (!refreshResponse.ok) {
    throw new Error('Failed to refresh Google token');
  }

  const refreshData = await refreshResponse.json();
  
  // Update the access token in database
  await supabase
    .from('google_integrations')
    .update({ access_token: refreshData.access_token })
    .eq('user_id', userId);

  return refreshData.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileId, mimeType, fileName } = await req.json();
    
    if (!fileId || !mimeType) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: fileId and mimeType' 
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

    // Get valid access token
    const accessToken = await getValidAccessToken(user.id, supabase);
    
    let content = '';
    let success = true;
    let error = '';

    console.log('📄 [GOOGLE-DRIVE] Fetching content for:', fileName, 'Type:', mimeType);

    try {
      if (mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as plain text
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
          { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 10000 // 10 second timeout
          }
        );
        
        if (response.ok) {
          content = await response.text();
        } else {
          throw new Error(`Failed to export Google Doc: ${response.status}`);
        }
        
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Export Google Sheet as CSV
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
          { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 10000
          }
        );
        
        if (response.ok) {
          content = await response.text();
        } else {
          throw new Error(`Failed to export Google Sheet: ${response.status}`);
        }
        
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Export Google Slides as plain text (limited content)
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
          { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 10000
          }
        );
        
        if (response.ok) {
          content = await response.text();
        } else {
          throw new Error(`Failed to export Google Slides: ${response.status}`);
        }
        
      } else if (mimeType === 'application/pdf') {
        // Download PDF file content
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 15000
          }
        );
        
        if (response.ok) {
          const fileData = await response.arrayBuffer();
          content = await parsePdfContent(fileData);
        } else {
          throw new Error(`Failed to download PDF: ${response.status}`);
        }
        
      } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
        // Download text file content
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 10000
          }
        );
        
        if (response.ok) {
          const fileData = await response.arrayBuffer();
          content = new TextDecoder().decode(fileData);
        } else {
          throw new Error(`Failed to download text file: ${response.status}`);
        }
        
      } else {
        // Unsupported file type - return metadata only
        content = `[File: ${fileName}]\n[Type: ${mimeType}]\n[Content extraction not supported for this file type]`;
        console.log('📄 [GOOGLE-DRIVE] Unsupported file type:', mimeType);
      }
      
    } catch (fetchError) {
      console.error('Error fetching file content:', fetchError);
      success = false;
      error = `Failed to fetch content: ${fetchError.message}`;
      content = `[Error: Could not fetch content for ${fileName}]`;
    }
    
    // Truncate if too long
    const maxLength = 50000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
      console.log('📄 [GOOGLE-DRIVE] Content truncated for:', fileName);
    }
    
    console.log('📄 [GOOGLE-DRIVE] Successfully fetched content for:', fileName, 'Length:', content.length);
    
    return new Response(JSON.stringify({
      success,
      content,
      fileName,
      mimeType,
      error: error || undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fetch-google-drive-file-content:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        content: '',
        fileName: '',
        mimeType: ''
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});










