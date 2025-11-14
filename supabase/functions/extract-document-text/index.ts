import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// Import PDF.js for direct PDF text extraction
// Use version 3.11.174 which has better Deno compatibility
import * as pdfjsLib from 'npm:pdfjs-dist@3.11.174';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractDocumentTextRequest {
  companyId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  bucket?: string;
  extractedText?: string; // Optional: pre-extracted text from frontend
}

const OPENAI_FILES_ENDPOINT = 'https://api.openai.com/v1/files';
const MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB (OpenAI limit)
const ASSISTANT_ID = 'asst_LpuVj6mPTIqyOUSmw6eLJdhr';

// Configure PDF.js for Deno Edge Functions
// Disable worker as Deno Edge Functions don't support worker URLs
// Use a data URL approach or disable worker completely
// Try to prevent PDF.js from initializing a worker at all
try {
  // Set worker source to empty to disable worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  
  // Override the worker initialization if possible
  // PDF.js v3.11.174 should handle empty workerSrc better
} catch (e) {
  console.warn('📄 [EXTRACT-TEXT] Worker configuration warning:', e);
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract text directly from PDF using PDF.js
 * This provides actual document content instead of AI-generated summaries
 */
async function extractTextFromPDF(fileData: Blob): Promise<string> {
  console.log('📄 [EXTRACT-TEXT] Extracting text from PDF using PDF.js...');
  
  const arrayBuffer = await fileData.arrayBuffer();
  
  // Load PDF document without worker (Deno Edge Functions limitation)
  // PDF.js will fall back to main thread processing
  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0, // Reduce logging
    });
    pdf = await loadingTask.promise;
  } catch (error: any) {
    // If any error occurs (especially worker-related), throw to trigger fallback
    const errorMsg = error?.message || String(error);
    console.error('📄 [EXTRACT-TEXT] PDF.js error:', errorMsg);
    
    // Throw to trigger fallback to OpenAI
    throw new Error(`PDF.js extraction failed: ${errorMsg}`);
  }
  
  console.log(`📄 [EXTRACT-TEXT] PDF loaded: ${pdf.numPages} pages`);
  
  // Array to store page texts in order
  const pageTexts: string[] = new Array(pdf.numPages);
  const concurrency = 4; // Process pages in batches for efficiency
  
  // Helper function to extract text from a single page
  async function extractPage(pageIndex: number): Promise<void> {
    const page = await pdf.getPage(pageIndex + 1); // PDF.js uses 1-based indexing
    const textContent = await page.getTextContent();
    
    // Join text items preserving order
    const pageText = textContent.items
      .map((item: any) => {
        if ('str' in item && item.str) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    
    pageTexts[pageIndex] = pageText.trim();
    
    if ((pageIndex + 1) % 10 === 0 || pageIndex === pdf.numPages - 1) {
      console.log(`📄 [EXTRACT-TEXT] Extracted ${pageIndex + 1}/${pdf.numPages} pages`);
    }
  }
  
  // Process pages in batches for better performance with large PDFs
  const pageIndices = Array.from({ length: pdf.numPages }, (_, i) => i);
  
  for (let i = 0; i < pageIndices.length; i += concurrency) {
    const batch = pageIndices.slice(i, i + concurrency);
    await Promise.all(batch.map(extractPage));
  }
  
  // Combine all pages with page markers
  const fullText = pageTexts
    .map((text, index) => {
      if (text) {
        return `--- Page ${index + 1} ---\n${text}`;
      }
      return `--- Page ${index + 1} ---\n[No text content found]`;
    })
    .join('\n\n');
  
  console.log(`📄 [EXTRACT-TEXT] PDF extraction complete: ${fullText.length} characters`);
  
  return fullText;
}

async function uploadFileToOpenAI({
  file,
  fileName,
  mimeType,
  apiKey,
}: {
  file: Blob;
  fileName: string;
  mimeType?: string;
  apiKey: string;
}): Promise<string> {
  const formData = new FormData();
  formData.append('purpose', 'assistants');

  const fileWithName = new File([file], fileName, { type: mimeType || file.type || 'application/octet-stream' });
  formData.append('file', fileWithName);

  const uploadResponse = await fetch(OPENAI_FILES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}));
    throw new Error(`Failed to upload file to OpenAI: ${uploadResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const uploadData = await uploadResponse.json();
  console.log('📄 [EXTRACT-TEXT] Uploaded file to OpenAI:', {
    fileId: uploadData.id,
    filename: uploadData.filename,
    bytes: uploadData.bytes,
  });
  return uploadData.id as string;
}

async function deleteOpenAIFile(fileId: string, apiKey: string): Promise<void> {
  try {
    const deleteResponse = await fetch(`${OPENAI_FILES_ENDPOINT}/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!deleteResponse.ok) {
      console.warn('📄 [EXTRACT-TEXT] Warning: Failed to delete OpenAI file:', fileId);
    } else {
      console.log('📄 [EXTRACT-TEXT] Deleted OpenAI file:', fileId);
    }
  } catch (error) {
    console.warn('📄 [EXTRACT-TEXT] Warning: Error deleting OpenAI file:', error);
  }
}

async function createThreadWithMessage(
  fileIds: string[],
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: `Extract and present the actual content, facts, data points, and information from the attached document.

CRITICAL REQUIREMENTS:
- Extract actual text, quotes, facts, figures, names, dates, and data from the document
- Present the document's actual content in a structured format
- Use direct quotes and preserve actual wording from the document
- Extract real data points, numbers, names, dates, and facts
- NEVER write meta-commentary like "The document provides..." or "The document begins..."
- NEVER write explanations about what the document contains - extract the actual content itself
- Organize the extracted content logically with clear sections
- Be thorough - extract as much actual content as possible while staying within token limits

Output ONLY the actual extracted content from the document, structured clearly. Do not add any commentary, analysis, or meta-text about the document.`,
          attachments: fileIds.map(fileId => ({
            file_id: fileId,
            tools: [
              {
                type: 'file_search'
              }
            ]
          }))
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Thread creation error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.id;
}

async function createRun(threadId: string, assistantId: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    body: JSON.stringify({
      assistant_id: assistantId,
      instructions: `Extract and present the actual content from the attached document. Extract actual text, quotes, facts, data points, numbers, names, dates, and information directly from the document text.`,
      additional_instructions: `CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:

1. Read the COMPLETE document from beginning to end
2. Extract ACTUAL CONTENT from the document:
   - Actual sentences, paragraphs, and quotes from the document
   - Real facts, figures, numbers, names, dates, and data points
   - Actual information and statements from the document
   - Direct quotes preserving exact wording
3. NEVER write meta-commentary such as:
   - "The document provides..." or "The document begins..."
   - "The analysis identifies..." or "The document discusses..."
   - Any explanations about what the document contains
   - Any commentary about the document structure
4. Extract actual content only - present what the document SAYS, not what it CONTAINS
5. Structure the extracted content logically with clear sections
6. Be thorough - extract as much actual content as possible
7. Output ONLY the extracted content - no commentary, no meta-text, no explanations

Your job is to extract and present the actual document content. Extract actual text, quotes, facts, and data from the document. Start extracting now.`
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Run creation error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.id;
}

async function waitForRunCompletion(threadId: string, runId: string, apiKey: string): Promise<void> {
  const maxAttempts = 180; // up to 180 seconds for large/complex PDFs
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(1000);
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'completed') {
        return;
      } else if (data.status === 'failed') {
        throw new Error(`Run failed: ${data.last_error?.message || 'Unknown error'}`);
      }
      if (attempt % 10 === 0) {
        console.log('📄 [EXTRACT-TEXT] Run status:', { attempt: attempt + 1, status: data.status });
      }
    }
    
    if (attempt % 10 === 0) console.log('📄 [EXTRACT-TEXT] Waiting for run completion, attempt:', attempt + 1);
  }
  
  throw new Error('Timed out waiting for OpenAI to process the document. Please try again later.');
}

async function getThreadMessages(threadId: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get response messages');
  }

  const messagesData = await response.json();
  
  // Get ALL assistant messages and concatenate them
  const assistantMessages = messagesData.data.filter((msg: any) => msg.role === 'assistant');
  
  if (assistantMessages.length === 0) {
    throw new Error('No assistant response found');
  }

  // Concatenate all assistant message content
  let fullText = '';
  for (const msg of assistantMessages) {
    const textContent = msg.content?.find((c: any) => c.type === 'text')?.text?.value || '';
    if (textContent) {
      fullText += textContent + '\n\n';
    }
  }

  return fullText.trim();
}

async function cleanupThread(threadId: string, apiKey: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/threads/${threadId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
  } catch (error) {
    console.warn('📄 [EXTRACT-TEXT] Warning: Failed to delete thread:', error);
  }
}

/**
 * Generate document summary using OpenAI Assistants API
 * Returns summary text and OpenAI resource IDs for metadata tracking
 */
async function generateDocumentSummaryWithOpenAI(
  fileData: Blob,
  fileName: string,
  fileType: string,
  apiKey: string
): Promise<{ summary: string; fileId: string | null; threadId: string | null; runId: string | null }> {
  let threadId: string | null = null;
  let openAIFileId: string | null = null;
  let runId: string | null = null;

  try {
    console.log('📄 [EXTRACT-TEXT] Starting OpenAI summary generation:', fileName);
    
    // Upload file to OpenAI
    openAIFileId = await uploadFileToOpenAI({
      file: fileData,
      fileName,
      mimeType: fileType,
      apiKey,
    });

    // Create thread with message containing file attachment
    threadId = await createThreadWithMessage([openAIFileId], apiKey);
    console.log('📄 [EXTRACT-TEXT] Thread created:', threadId);

    // Run assistant
    runId = await createRun(threadId, ASSISTANT_ID, apiKey);
    console.log('📄 [EXTRACT-TEXT] Run created:', runId);

    // Wait for completion
    await waitForRunCompletion(threadId, runId, apiKey);
    console.log('📄 [EXTRACT-TEXT] Run completed');

    // Get response messages
    const summary = await getThreadMessages(threadId, apiKey);

    console.log('📄 [EXTRACT-TEXT] OpenAI summary generation successful:', {
      fileName,
      summaryLength: summary.length,
    });

    return {
      summary,
      fileId: openAIFileId,
      threadId: threadId,
      runId: runId,
    };

  } finally {
    // Cleanup OpenAI resources
    if (openAIFileId) {
      await deleteOpenAIFile(openAIFileId, apiKey);
    }
    if (threadId) {
      await cleanupThread(threadId, apiKey);
    }
  }
}

async function storeTestResult(
  supabaseClient: ReturnType<typeof createClient>,
  {
    fileName,
    filePath,
    fileSize,
    fileType,
    extractedText,
    assistantResponse,
    openaiFileId,
    openaiThreadId,
    openaiRunId,
  }: {
    fileName: string;
    filePath: string;
    fileSize: number;
    fileType: string;
    extractedText: string;
    assistantResponse: string;
    openaiFileId: string;
    openaiThreadId: string;
    openaiRunId: string;
  }
): Promise<string> {
  const { data, error } = await supabaseClient
    .from('extracted_text_test_results')
    .insert({
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
      file_type: fileType,
      extracted_text: extractedText,
      assistant_response: assistantResponse,
      openai_file_id: openaiFileId,
      openai_thread_id: openaiThreadId,
      openai_run_id: openaiRunId,
      metadata: {
        created_at: new Date().toISOString(),
      }
    })
    .select('id')
    .single();

  if (error) {
    console.error('📄 [EXTRACT-TEXT] Database insert error:', error);
    throw error;
  }

  return data.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody: ExtractDocumentTextRequest = await req.json();
    const {
      companyId: reqCompanyId,
      filePath,
      fileName,
      fileType,
      bucket = 'documents',
      extractedText: preExtractedText // Pre-extracted text from frontend
    } = requestBody;

    if (!reqCompanyId || !filePath || !fileName || !fileType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Company ID, file path, file name, and file type are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📄 [EXTRACT-TEXT] Extracting text from document:', fileName);
    console.log('📄 [EXTRACT-TEXT] File type:', fileType);
    console.log('📄 [EXTRACT-TEXT] Company ID:', reqCompanyId);

    // Create service role client for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Fetch document from Supabase Storage
    console.log('📄 [EXTRACT-TEXT] Fetching document from storage...');
    console.log('📄 [EXTRACT-TEXT] Bucket:', bucket, 'Path:', filePath);
    
    const { data: fileData, error: downloadError } = await supabaseServiceClient.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('📄 [EXTRACT-TEXT] Storage download error:', downloadError);
      throw new Error(`Failed to download document: ${downloadError?.message || 'Unknown error'}`);
    }

    const fileSize = fileData.size;
    console.log('📄 [EXTRACT-TEXT] Document downloaded successfully, size:', fileSize, 'bytes');

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error('File is too large for OpenAI processing. Maximum supported size is 512MB.');
    }

    // Determine extraction method based on file type
    const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isWordDoc = fileType.includes('word') || 
                      fileType.includes('document') ||
                      fileName.toLowerCase().endsWith('.docx') || 
                      fileName.toLowerCase().endsWith('.doc');
    const isTextFile = fileType.startsWith('text/') || 
                       fileName.toLowerCase().endsWith('.txt') || 
                       fileName.toLowerCase().endsWith('.md');

    let documentSummary: string;
    let extractionMethod: string;
    let openaiFileId: string | null = null;
    let openaiThreadId: string | null = null;
    let openaiRunId: string | null = null;

    try {
      // If pre-extracted text is provided (from frontend PDF extraction), use it directly
      if (preExtractedText && preExtractedText.trim()) {
        console.log('📄 [EXTRACT-TEXT] Using pre-extracted text from frontend');
        documentSummary = preExtractedText;
        extractionMethod = 'frontend_pdfjs_extraction';
      } else if (isPDF) {
        // Try PDF.js extraction on server (fallback if frontend extraction failed)
        console.log('📄 [EXTRACT-TEXT] Attempting PDF.js extraction on server:', fileName);
        try {
          const extractedText = await extractTextFromPDF(fileData);
          documentSummary = extractedText;
          extractionMethod = 'pdfjs_direct_extraction';
          console.log('📄 [EXTRACT-TEXT] PDF extraction successful');
        } catch (pdfError) {
          console.error('📄 [EXTRACT-TEXT] PDF.js extraction failed, falling back to OpenAI:', pdfError);
          // Fallback to OpenAI if PDF.js fails
          const openaiResult = await generateDocumentSummaryWithOpenAI(fileData, fileName, fileType, openaiApiKey);
          documentSummary = openaiResult.summary;
          extractionMethod = 'openai_assistant_agent_fallback';
          openaiFileId = openaiResult.fileId;
          openaiThreadId = openaiResult.threadId;
          openaiRunId = openaiResult.runId;
        }
      } else if (isWordDoc) {
        // Use OpenAI for Word documents
        console.log('📄 [EXTRACT-TEXT] Generating summary using OpenAI for Word document:', fileName);
        const openaiResult = await generateDocumentSummaryWithOpenAI(fileData, fileName, fileType, openaiApiKey);
        documentSummary = openaiResult.summary;
        extractionMethod = 'openai_assistant_agent';
        openaiFileId = openaiResult.fileId;
        openaiThreadId = openaiResult.threadId;
        openaiRunId = openaiResult.runId;
      } else if (isTextFile) {
        // For text files, read directly
        const textContent = await fileData.text();
        documentSummary = textContent;
        extractionMethod = 'direct_text';
        console.log('📄 [EXTRACT-TEXT] Processed text file directly');
      } else {
        // For other file types, try OpenAI
        console.log('📄 [EXTRACT-TEXT] Unknown file type, attempting OpenAI summary generation');
        const openaiResult = await generateDocumentSummaryWithOpenAI(fileData, fileName, fileType, openaiApiKey);
        documentSummary = openaiResult.summary;
        extractionMethod = 'openai_assistant_agent';
        openaiFileId = openaiResult.fileId;
        openaiThreadId = openaiResult.threadId;
        openaiRunId = openaiResult.runId;
      }

      console.log('📄 [EXTRACT-TEXT] ✅ Summary generation successful!', {
        fileName,
        extractionMethod,
        summaryLength: documentSummary.length,
      });

      // Step 7: Store results in testing table
      const testRecordId = await storeTestResult(supabaseServiceClient, {
        fileName,
        filePath,
        fileSize,
        fileType,
        extractedText: documentSummary,
        assistantResponse: documentSummary,
        openaiFileId: openaiFileId || '',
        openaiThreadId: openaiThreadId || '',
        openaiRunId: openaiRunId || '',
      });

      console.log('📄 [EXTRACT-TEXT] Results stored in testing table:', testRecordId);

      // Step 8: Store document summary in company_os table
      const { data: existingOS } = await supabaseServiceClient
        .from('company_os')
        .select('id, version')
        .eq('company_id', reqCompanyId)
        .single();

      let companyOSRecordId: string;
      
      if (existingOS) {
        // Update existing record
        const { data, error } = await supabaseServiceClient
          .from('company_os')
          .update({
            raw_scraped_text: documentSummary, // Store summary as raw_scraped_text for backward compatibility
            status: 'draft',
            last_updated: new Date().toISOString(),
            metadata: {
              source_type: 'document_upload',
              source_document: {
                fileName,
                filePath,
                fileType,
                fileSize,
                uploadedAt: new Date().toISOString()
              },
              extraction_completed_at: new Date().toISOString(),
              extraction_method: extractionMethod,
              document_summary: documentSummary, // Store summary separately
              openai_file_id: openaiFileId || null,
              openai_thread_id: openaiThreadId || null,
              openai_run_id: openaiRunId || null,
              summary_length: documentSummary.length,
              test_record_id: testRecordId
            }
          })
          .eq('company_id', reqCompanyId)
          .select('id')
          .single();

        if (error) {
          console.error('📄 [EXTRACT-TEXT] Database update error:', error);
          throw error;
        }
        
        companyOSRecordId = data.id;
        console.log('📄 [EXTRACT-TEXT] Updated existing CompanyOS record');
      } else {
        // Create new draft record
        const { data, error } = await supabaseServiceClient
          .from('company_os')
          .insert({
            company_id: reqCompanyId,
            os_data: {},
            raw_scraped_text: documentSummary, // Store summary as raw_scraped_text for backward compatibility
            status: 'draft',
            version: 0,
            generated_by: user.id,
            metadata: {
              source_type: 'document_upload',
              source_document: {
                fileName,
                filePath,
                fileType,
                fileSize,
                uploadedAt: new Date().toISOString()
              },
              extraction_completed_at: new Date().toISOString(),
              extraction_method: extractionMethod,
              document_summary: documentSummary, // Store summary separately
              openai_file_id: openaiFileId || null,
              openai_thread_id: openaiThreadId || null,
              openai_run_id: openaiRunId || null,
              summary_length: documentSummary.length,
              test_record_id: testRecordId
            }
          })
          .select('id')
          .single();

        if (error) {
          console.error('📄 [EXTRACT-TEXT] Database insert error:', error);
          throw error;
        }
        
        companyOSRecordId = data.id;
        console.log('📄 [EXTRACT-TEXT] Created new draft CompanyOS record');
      }

      // Step 9: Trigger generate-company-os-from-document function
      console.log('📄 [EXTRACT-TEXT] Triggering generate-company-os-from-document function...');
      
      try {
        const generateResponse = await supabaseClient.functions.invoke('generate-company-os-from-document', {
          body: {
            companyId: reqCompanyId,
            filePath: filePath,
            fileName: fileName,
            fileType: fileType,
            bucket: bucket,
            additionalContext: documentSummary, // Pass summary as additional context
          }
        });

        if (generateResponse.error) {
          console.error('📄 [EXTRACT-TEXT] Error triggering generate-company-os-from-document:', generateResponse.error);
          // Don't throw - summary generation was successful, CompanyOS generation is separate
          console.warn('📄 [EXTRACT-TEXT] Summary generation completed but CompanyOS generation failed. User can retry generation manually.');
        } else if (generateResponse.data?.success) {
          console.log('📄 [EXTRACT-TEXT] ✅ CompanyOS generation triggered successfully');
        } else {
          console.warn('📄 [EXTRACT-TEXT] CompanyOS generation returned unsuccessful:', generateResponse.data?.error);
        }
      } catch (genError) {
        console.error('📄 [EXTRACT-TEXT] Exception triggering generate-company-os-from-document:', genError);
        // Don't throw - summary generation was successful
      }

      const executionTime = Date.now() - startTime;
      console.log(`📄 [EXTRACT-TEXT] Execution time: ${executionTime}ms (${(executionTime / 1000).toFixed(1)}s)`);

      return new Response(JSON.stringify({
        success: true,
        documentSummary,
        summaryLength: documentSummary.length,
        testRecordId,
        companyOSRecordId,
        metadata: {
          fileName,
          extractionMethod,
          extractionTime: executionTime,
          fileSize,
          openaiFileId: openaiFileId || null,
          openaiThreadId: openaiThreadId || null,
          openaiRunId: openaiRunId || null,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } finally {
      // Cleanup OpenAI resources (only if we used OpenAI and haven't cleaned up yet)
      // Note: generateDocumentSummaryWithOpenAI handles its own cleanup, so this is mainly for safety
      // In practice, this should rarely be needed since generateDocumentSummaryWithOpenAI cleans up
    }

  } catch (error) {
    console.error('📄 [EXTRACT-TEXT] ❌ Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
