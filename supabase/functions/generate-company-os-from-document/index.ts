import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateCompanyOSFromDocumentRequest {
  companyId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  additionalContext?: string;
  bucket?: string;
}

function sanitizeDocumentText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n');
}

function summarizeDocumentText(text: string, maxLength = 1200): string {
  if (!text) return '';
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const breakIndex = Math.max(
    truncated.lastIndexOf('\n\n'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('\n')
  );

  if (breakIndex > maxLength * 0.6) {
    return `${truncated.slice(0, breakIndex).trim()}…`;
  }

  return `${truncated.trim()}…`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let companyId: string | undefined;

  try {
    const startTime = Date.now();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('🏢 [COMPANY-OS-DOC] Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      companyId: reqCompanyId,
      filePath,
      fileName,
      fileType,
      additionalContext = '',
      bucket = 'documents'
    }: GenerateCompanyOSFromDocumentRequest = await req.json();

    companyId = reqCompanyId;

    if (!companyId || !filePath || !fileName || !fileType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company ID, file path, file name, and file type are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🏢 [COMPANY-OS-DOC] Saving uploaded CompanyOS document:', fileName);

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: fileData, error: downloadError } = await supabaseServiceClient.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('🏢 [COMPANY-OS-DOC] Storage download error:', downloadError);
      throw new Error(`Failed to download document: ${downloadError?.message || 'Unknown error'}`);
    }

    const fileSize = fileData.size;

    const { data: existingOS, error: existingOSError } = await supabaseServiceClient
      .from('company_os')
      .select('id, version, metadata, raw_scraped_text')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existingOSError && existingOSError.code !== 'PGRST116') {
      throw existingOSError;
    }

    const previousText = existingOS?.raw_scraped_text || '';
    let documentText = typeof additionalContext === 'string' && additionalContext.length
      ? additionalContext
      : previousText;

    if (!documentText?.trim()) {
      try {
        documentText = await fileData.text();
      } catch (textError) {
        console.warn('🏢 [COMPANY-OS-DOC] Unable to read document contents directly:', textError);
      }
    }

    if (!documentText?.trim()) {
      throw new Error('No extracted document text available. Please retry the upload process.');
    }

    const cleanedText = sanitizeDocumentText(documentText);
    const nowIso = new Date().toISOString();
    const summary = summarizeDocumentText(cleanedText);

    const mergedMetadata = {
      ...(existingOS?.metadata || {}),
      source_type: 'document_upload',
      source_document: {
        fileName,
        filePath,
        fileType,
        fileSize,
        uploadedAt: nowIso,
      },
      document_summary: summary,
      document_text_length: cleanedText.length,
      ingestion_method: 'direct_document_upload',
      document_mode: true,
    };

    const nextVersion = existingOS ? (existingOS.version || 0) + 1 : 1;

    const baseFields = {
      os_data: {},
      raw_scraped_text: cleanedText,
      version: nextVersion,
      last_updated: nowIso,
      generated_by: user.id,
      source_url: null,
      status: 'completed' as const,
      metadata: mergedMetadata,
    };

    let result;

    if (existingOS) {
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .update(baseFields)
        .eq('company_id', companyId)
        .select('*')
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS-DOC] Updated existing CompanyOS with raw document text.');
    } else {
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .insert({
          ...baseFields,
          company_id: companyId,
          generated_at: nowIso,
        })
        .select('*')
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS-DOC] Created new CompanyOS record from document upload.');
    }

    const executionTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      companyOS: result,
      metadata: {
        fileName,
        sourceType: 'document_upload',
        generated_at: nowIso,
        execution_time: executionTime,
        ingestion: 'direct_document_upload',
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('🏢 [COMPANY-OS-DOC] Error:', error);

    if (companyId) {
      try {
        const supabaseServiceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseServiceClient
          .from('company_os')
          .update({ status: 'failed' })
          .eq('company_id', companyId);
      } catch (statusError) {
        console.error('🏢 [COMPANY-OS-DOC] Failed to update status:', statusError);
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while saving the document',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
