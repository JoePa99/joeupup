import { supabase } from "@/integrations/supabase/client";

export interface DocumentProcessingResult {
  success: boolean;
  message: string;
  data?: {
    document_id: string;
    content_length: number;
    embedding_dimensions: number;
    filename: string;
  };
  error?: string;
}

export interface ProcessDocumentRequest {
  document_archive_id: string;
  company_id: string;
  user_id: string;
}

/**
 * Process a document for embeddings using the Supabase Edge Function
 */
export async function processDocumentForEmbeddings(
  documentArchiveId: string,
  companyId: string,
  userId: string,
  agentId?: string
): Promise<DocumentProcessingResult> {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No active session found');
    }

    // Use the already configured Supabase client URL and key
    const supabaseUrl = "https://chaeznzfvbgrpzvxwvyu.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYWV6bnpmdmJncnB6dnh3dnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTIwMTUsImV4cCI6MjA3MDc2ODAxNX0.tninczi1BMTk6G6knEMN8QKPMaAbFZjRkxg71CINcTY";
    
    console.log('Processing document for embeddings:', {
      documentArchiveId,
      companyId,
      userId,
      agentId,
      supabaseUrl,
      hasSession: !!session,
      hasAccessToken: !!session.access_token
    });
    
    const requestBody: any = {
      document_archive_id: documentArchiveId,
      company_id: companyId,
      user_id: userId
    };
    
    if (agentId) {
      requestBody.agent_id = agentId;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process-documents-embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Edge function response status:', response.status);
    console.log('Edge function response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: Failed to process document`;
      let errorData: any = null;
      
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        
        // Log the full error for debugging
        console.error('Full error response:', errorData);
        
        // Check if it's a token limit error
        if (errorData.error && (errorData.error.includes('maximum context length') || errorData.error.includes('token'))) {
          console.warn('Token limit exceeded, this should be handled by the Edge Function chunking');
          errorMessage = 'Document is too large for processing. The system will automatically chunk it into smaller pieces.';
        }
      } catch (parseError) {
        console.warn('Could not parse error response:', parseError);
        // Try to get the raw text response
        try {
          const rawText = await response.text();
          console.error('Raw error response:', rawText);
          errorMessage = `HTTP ${response.status}: ${rawText}`;
        } catch (textError) {
          console.error('Could not read response text:', textError);
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Document processed for embeddings successfully:', result);
    
    // Add information about chunking if applicable
    if (result.data && result.data.total_chunks > 1) {
      result.message = `Document processed successfully in ${result.data.total_chunks} chunks for better search accuracy.`;
    }
    
    // Verify that documents were actually created in the database
    try {
      const { data: docRows, error: verifyError } = await supabase
        .from('documents')
        .select('id, content, document_archive_id')
        .eq('document_archive_id', documentArchiveId);
      
      if (verifyError) {
        console.warn('Could not verify document indexing:', verifyError);
      } else if (!docRows || docRows.length === 0) {
        console.error('CRITICAL: No document rows found after processing - indexing may have failed');
        result.warning = 'Document uploaded but may not be searchable. Please contact support.';
      } else {
        console.log(`Verified: ${docRows.length} document chunks created for archive ${documentArchiveId}`);
      }
    } catch (verifyError) {
      console.warn('Error during document verification:', verifyError);
    }
    
    return result;
  } catch (error: any) {
    console.error('Error processing document for embeddings:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      message: 'Failed to process document for embeddings'
    };
  }
}

/**
 * Process multiple documents for embeddings
 */
export async function processMultipleDocumentsForEmbeddings(
  documents: Array<{ id: string; name: string }>,
  companyId: string,
  userId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<DocumentProcessingResult[]> {
  const results: DocumentProcessingResult[] = [];
  let completed = 0;
  const total = documents.length;

  for (const doc of documents) {
    try {
      const result = await processDocumentForEmbeddings(doc.id, companyId, userId);
      results.push(result);
      
      completed++;
      onProgress?.(completed, total);
      
      // Add a small delay between requests to avoid overwhelming the API
      if (completed < total) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      const errorResult: DocumentProcessingResult = {
        success: false,
        error: error.message || 'Unknown error',
        message: `Failed to process ${doc.name}`
      };
      results.push(errorResult);
      
      completed++;
      onProgress?.(completed, total);
    }
  }

  return results;
}

/**
 * Check if a document has been processed for embeddings
 */
export async function checkDocumentProcessingStatus(
  documentArchiveId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .eq('document_archive_id', documentArchiveId)
      .single();

    if (error) {
      return false;
    }

    return !!data;
  } catch (error) {
    return false;
  }
}

/**
 * Get processing statistics for a company
 */
export async function getDocumentProcessingStats(companyId: string) {
  try {
    const { data: totalDocs, error: totalError } = await supabase
      .from('document_archives')
      .select('id')
      .eq('company_id', companyId);

    const { data: processedDocs, error: processedError } = await supabase
      .from('documents')
      .select('id')
      .eq('company_id', companyId);

    if (totalError || processedError) {
      throw new Error('Failed to fetch processing statistics');
    }

    return {
      total: totalDocs?.length || 0,
      processed: processedDocs?.length || 0,
      pending: (totalDocs?.length || 0) - (processedDocs?.length || 0)
    };
  } catch (error) {
    console.error('Error fetching processing stats:', error);
    return { total: 0, processed: 0, pending: 0 };
  }
}

/**
 * Embed inline document content directly into the documents table
 */
export async function embedInlineDocument(
  companyId: string,
  userId: string,
  content: string,
  title?: string,
  sectionTag?: string,
  description?: string,
  playbookSectionId?: string
): Promise<DocumentProcessingResult> {
  try {
    // Get the current session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No active session found');
    }

    // Use the already configured Supabase client URL and key
    const supabaseUrl = "https://chaeznzfvbgrpzvxwvyu.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYWV6bnpmdmJncnB6dnh3dnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTIwMTUsImV4cCI6MjA3MDc2ODAxNX0.tninczi1BMTk6G6knEMN8QKPMaAbFZjRkxg71CINcTY";
    
    console.log('Embedding inline document:', {
      companyId,
      userId,
      contentLength: content.length,
      title,
      sectionTag,
      hasSession: !!session,
      hasAccessToken: !!session.access_token
    });
    
    const response = await fetch(`${supabaseUrl}/functions/v1/embed-inline-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        company_id: companyId,
        user_id: userId,
        content: content,
        title: title,
        section_tag: sectionTag,
        description: description,
        playbook_section_id: playbookSectionId
      }),
    });

    console.log('Embed inline document response status:', response.status);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: Failed to embed document`;
      let errorData: any = null;
      
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        
        // Log the full error for debugging
        console.error('Full error response:', errorData);
      } catch (parseError) {
        console.warn('Could not parse error response:', parseError);
        // Try to get the raw text response
        try {
          const rawText = await response.text();
          console.error('Raw error response:', rawText);
          errorMessage = `HTTP ${response.status}: ${rawText}`;
        } catch (textError) {
          console.error('Could not read response text:', textError);
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Document embedded successfully:', result);
    
    // Add information about chunking if applicable
    if (result.data && result.data.total_chunks > 1) {
      result.message = `Document embedded successfully in ${result.data.total_chunks} chunks for better search accuracy.`;
    }
    
    return result;
  } catch (error: any) {
    console.error('Error embedding inline document:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      message: 'Failed to embed document'
    };
  }
}

/**
 * Test if the Edge Function is accessible
 */
export async function testEdgeFunctionAccess(): Promise<boolean> {
  try {
    const supabaseUrl = "https://chaeznzfvbgrpzvxwvyu.supabase.co";
    
    console.log('Testing Edge Function accessibility...');
    
    // First try an OPTIONS request to check CORS
    const optionsResponse = await fetch(`${supabaseUrl}/functions/v1/process-documents-embeddings`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('OPTIONS response status:', optionsResponse.status);
    console.log('OPTIONS response headers:', Object.fromEntries(optionsResponse.headers.entries()));
    
    // Then try a GET request to see if the function responds
    const getResponse = await fetch(`${supabaseUrl}/functions/v1/process-documents-embeddings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('GET response status:', getResponse.status);
    console.log('GET response headers:', Object.fromEntries(getResponse.headers.entries()));
    
    // The function should return a 405 Method Not Allowed for GET, which means it's accessible
    return getResponse.status === 405 || optionsResponse.status === 200 || optionsResponse.status === 204;
  } catch (error) {
    console.error('Edge function health check failed:', error);
    return false;
  }
}
