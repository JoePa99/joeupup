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
    .eq('docs_enabled', true)
    .single();

  if (!integration) {
    throw new Error('Docs integration not found');
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
      api_service: 'docs',
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTime,
      error_message: error,
    });
}

function extractTextFromDocument(doc: any): string {
  let text = '';
  
  if (doc.body && doc.body.content) {
    for (const element of doc.body.content) {
      if (element.paragraph) {
        for (const textElement of element.paragraph.elements || []) {
          if (textElement.textRun) {
            text += textElement.textRun.content;
          }
        }
      } else if (element.table) {
        // Extract text from table cells
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            for (const cellElement of cell.content || []) {
              if (cellElement.paragraph) {
                for (const textElement of cellElement.paragraph.elements || []) {
                  if (textElement.textRun) {
                    text += textElement.textRun.content;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  return text;
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

    const { documentId, includeFormatting = false } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getValidAccessToken(supabaseClient, user.id);

    // Get document content
    const docsUrl = `https://docs.googleapis.com/v1/documents/${documentId}`;

    const docsResponse = await fetch(docsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!docsResponse.ok) {
      const error = await docsResponse.text();
      console.error('Docs API error:', error);
      
      if (profile?.company_id) {
        await logApiCall(supabaseClient, user.id, profile.company_id, 'documents', 'GET', docsResponse.status, responseTime, error);
      }
      
      return new Response(JSON.stringify({ error: 'Failed to read document' }), {
        status: docsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const docData = await docsResponse.json();
    
    if (profile?.company_id) {
      await logApiCall(supabaseClient, user.id, profile.company_id, 'documents', 'GET', 200, responseTime);
    }

    // Extract plain text content
    const textContent = extractTextFromDocument(docData);

    // Cache the document content for AI processing
    if (textContent) {
      // Add to Drive files cache as well for unified search
      try {
        await supabaseClient
          .from('google_drive_files')
          .upsert({
            user_id: user.id,
            company_id: profile?.company_id || null,
            drive_file_id: documentId,
            name: docData.title || 'Untitled Document',
            mime_type: 'application/vnd.google-apps.document',
            content: textContent,
            web_view_link: `https://docs.google.com/document/d/${documentId}/edit`,
            created_time: docData.createdTime,
            modified_time: docData.modifiedTime,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'user_id,drive_file_id' });
        console.log('Cached document content to database');
      } catch (cacheError) {
        console.error('Failed to cache document:', cacheError);
      }
    }

    // Prepare response
    const response = {
      documentId: docData.documentId,
      title: docData.title,
      body: includeFormatting ? docData.body : undefined,
      textContent,
      revisionId: docData.revisionId,
      createdTime: docData.createdTime,
      modifiedTime: docData.modifiedTime,
      metadata: {
        wordCount: textContent.split(/\s+/).length,
        characterCount: textContent.length,
        lastFetched: new Date().toISOString(),
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Docs read content error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});