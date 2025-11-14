import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseDocumentRequest {
  filePath: string;
  fileName: string;
  fileType: string;
  bucket?: string;
}

async function extractTextFromPDF(fileData: Blob, fileName: string): Promise<string> {
  try {
    console.log('📄 [DEBUG] Starting OpenAI PDF text extraction, file size:', fileData.size);
    
    // Convert blob to base64 for OpenAI API
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = base64Encode(uint8Array);
    
    console.log('📄 [DEBUG] PDF converted to base64, length:', base64.length);
    
    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    // Call OpenAI to extract text from PDF
    const extractedText = await extractTextWithOpenAI(base64, fileName, openaiApiKey);
    
    if (extractedText && extractedText.trim().length > 10) {
      console.log('📄 [SUCCESS] OpenAI PDF text extracted, length:', extractedText.length);
      return cleanExtractedText(extractedText);
    }
    
    // If extraction fails, return descriptive message
    console.log('📄 [WARNING] OpenAI could not extract text from PDF');
    return `[PDF Processing Notice: Unable to extract readable text from "${fileName}". The file may be image-based, password-protected, or in a format that requires specialized processing. File size: ${fileData.size} bytes, Type: application/pdf]`;
    
  } catch (error) {
    console.error('📄 [ERROR] OpenAI PDF text extraction failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return `[PDF Processing Error: Failed to extract text from PDF file "${fileName}" (${fileData.size} bytes). Error: ${errorMessage}. The PDF may be corrupted, password-protected, or in an unsupported format.]`;
  }
}

// Extract text from PDF using OpenAI Assistants API
async function extractTextWithOpenAI(base64Data: string, fileName: string, apiKey: string): Promise<string> {
  try {
    console.log('🤖 [DEBUG] Starting OpenAI Assistants API workflow for PDF text extraction');
    
    // Step 1: Get a default assistant ID
    const assistantId = await getDefaultAssistantId(apiKey);
    console.log('🤖 [SUCCESS] Using assistant ID:', assistantId);
    
    // Step 2: Upload file to OpenAI
    const fileId = await uploadFileToOpenAI(base64Data, fileName, apiKey);
    console.log('🤖 [SUCCESS] File uploaded, ID:', fileId);
    
    // Step 3: Create a thread
    const threadId = await createThread(apiKey);
    console.log('🤖 [SUCCESS] Thread created, ID:', threadId);
    
    // Step 4: Attach file to thread
    await attachFileToThread(threadId, fileId, apiKey);
    console.log('🤖 [SUCCESS] File attached to thread');
    
    // Step 5: Send message to extract text
    const runId = await sendMessageToThread(threadId, fileName, assistantId, apiKey);
    console.log('🤖 [SUCCESS] Message sent, run ID:', runId);
    
    // Step 6: Wait for completion and get response
    const extractedText = await waitForCompletionAndGetResponse(threadId, runId, apiKey);
    console.log('🤖 [SUCCESS] Text extracted, length:', extractedText.length);
    
    // Step 7: Clean up
    await cleanup(threadId, fileId, apiKey);
    
    return extractedText;
    
  } catch (error) {
    console.error('🤖 [ERROR] OpenAI PDF extraction failed:', error);
    throw error;
  }
}

// Step 1: Get a default assistant ID
async function getDefaultAssistantId(apiKey: string): Promise<string> {
  try {
    // Get the first available assistant from OpenAI
    const response = await fetch('https://api.openai.com/v1/assistants', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get assistants: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No assistants found. Please create an assistant first.');
    }

    // Return the first assistant ID
    return data.data[0].id;
    
  } catch (error) {
    console.error('🤖 [ERROR] Failed to get default assistant ID:', error);
    throw error;
  }
}

// Step 2: Upload file to OpenAI
async function uploadFileToOpenAI(base64Data: string, fileName: string, apiKey: string): Promise<string> {
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  
  const formData = new FormData();
  const blob = new Blob([binaryData], { type: 'application/pdf' });
  formData.append('file', blob, fileName);
  formData.append('purpose', 'assistants');
  
  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`File upload error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.id;
}

// Step 2: Create a thread
async function createThread(apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Thread creation error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.id;
}

// Step 3: Attach file to thread
async function attachFileToThread(threadId: string, fileId: string, apiKey: string): Promise<void> {
  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    body: JSON.stringify({
      role: 'user',
      content: 'Please extract all text from the attached file.',
      attachments: [
        {
          file_id: fileId,
          tools: [{ type: 'file_search' }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`File attachment error: ${response.status} - ${JSON.stringify(errorData)}`);
  }
}

// Step 5: Send message to extract text
async function sendMessageToThread(threadId: string, fileName: string, assistantId: string, apiKey: string): Promise<string> {
  const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    },
    body: JSON.stringify({
      assistant_id: assistantId,
      instructions: `Please extract all readable text from the attached PDF file "${fileName}". Return only the extracted text content, without any additional commentary or formatting. If the PDF contains images, charts, or other non-text elements, please describe them briefly but focus on extracting the actual text content.`
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Message send error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.id;
}

// Step 6: Wait for completion and get response
async function waitForCompletionAndGetResponse(threadId: string, runId: string, apiKey: string): Promise<string> {
  // Wait for run to complete
  let completed = false;
  let attempts = 0;
  const maxAttempts = 90; // 90 seconds max wait for complex PDFs
  
  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'completed') {
        completed = true;
      } else if (data.status === 'failed') {
        throw new Error(`Run failed: ${data.last_error?.message || 'Unknown error'}`);
      }
    }
    
    attempts++;
  }
  
  if (!completed) {
    throw new Error(
      `Document processing took too long (>${maxAttempts}s). ` +
      `This might be due to document complexity, size, or API load. ` +
      `Please try again or consider splitting the document into smaller parts.`
    );
  }
  
  // Get the response messages
  const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  
  if (!messagesResponse.ok) {
    throw new Error('Failed to get response messages');
  }
  
  const messagesData = await messagesResponse.json();
  const assistantMessage = messagesData.data.find((msg: any) => msg.role === 'assistant');
  
  if (!assistantMessage) {
    throw new Error('No assistant response found');
  }
  
  return assistantMessage.content[0]?.text?.value || '';
}

// Step 7: Clean up
async function cleanup(threadId: string, fileId: string, apiKey: string): Promise<void> {
  try {
    // Delete thread
    await fetch(`https://api.openai.com/v1/threads/${threadId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    // Delete file
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    console.log('🤖 [CLEANUP] Thread and file deleted');
  } catch (error) {
    console.log('🤖 [WARNING] Cleanup failed:', error);
  }
}

// Conservative PDF text extraction that only extracts clear, readable text
async function extractTextConservative(bytes: Uint8Array): Promise<string> {
  const pdfString = new TextDecoder('latin1', { fatal: false }).decode(bytes);
  let extractedText = '';
  
  // Only look for clear text patterns that are likely to be actual content
  // Look for text between parentheses that contains readable words
  const textPattern = /\(([^)]+)\)/g;
  let match;
  
  while ((match = textPattern.exec(pdfString)) !== null) {
    const text = match[1];
    
    // Only include text that looks like real words
    if (isReadableText(text)) {
      extractedText += text + ' ';
    }
  }
  
  return extractedText;
}

// Check if text contains readable words (not just symbols or gibberish)
function isReadableText(text: string): boolean {
  if (!text || text.length < 3) return false;
  
  // Remove common PDF artifacts
  const cleanText = text.replace(/\\[nrtbf()\\]/g, '').trim();
  
  // Must contain at least one word with 3+ letters
  const words = cleanText.split(/\s+/).filter(word => word.length >= 3);
  if (words.length === 0) return false;
  
  // At least 50% of words should contain letters
  const wordCount = words.length;
  const letterWords = words.filter(word => /[a-zA-Z]/.test(word)).length;
  
  if (letterWords / wordCount < 0.5) return false;
  
  // Should not be mostly symbols
  const symbolCount = (cleanText.match(/[^\w\s]/g) || []).length;
  const symbolRatio = symbolCount / cleanText.length;
  
  if (symbolRatio > 0.7) return false;
  
  return true;
}

// Validate that extracted text is actually readable
function isValidText(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Check for excessive symbols (like the corrupted output you showed)
  const symbolCount = (text.match(/[^\w\s.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>-]/g) || []).length;
  const symbolRatio = symbolCount / text.length;
  
  if (symbolRatio > 0.3) {
    console.log('📄 [VALIDATION] Too many symbols in extracted text:', symbolRatio);
    return false;
  }
  
  // Must contain some readable words
  const words = text.split(/\s+/).filter(word => word.length >= 3);
  const readableWords = words.filter(word => /[a-zA-Z]{3,}/.test(word));
  
  if (readableWords.length < 3) {
    console.log('📄 [VALIDATION] Not enough readable words:', readableWords.length);
    return false;
  }
  
  return true;
}

function cleanExtractedText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }
  
  return rawText
    // Remove PDF-specific artifacts and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove PDF escape sequences
    .replace(/\\([nrtbf()\\])/g, (match, char) => {
      switch (char) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'b': return '\b';
        case 'f': return '\f';
        case '(': return '(';
        case ')': return ')';
        case '\\': return '\\';
        default: return match;
      }
    })
    // Remove excessive whitespace and normalize line breaks
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    // Remove common PDF artifacts and noise
    .replace(/[^\w\s.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>-]/g, ' ')
    // Remove multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove repeated words/phrases (common in PDFs)
    .replace(/\b(\w+)\s+\1\b/g, '$1')
    // Remove very short isolated words that are likely artifacts
    .replace(/\b\w{1,2}\b/g, (match) => {
      // Keep common short words
      const keepWords = ['a', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'];
      return keepWords.includes(match.toLowerCase()) ? match : '';
    })
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace from start and end
    .trim();
    // Removed text truncation to preserve full document content
}

async function extractTextFromDocument(fileData: Blob, fileType: string, fileName: string): Promise<string> {
  try {
    console.log(`📄 [DEBUG] Processing document: ${fileName}, type: ${fileType}, size: ${fileData.size} bytes`);
    
    if (fileType === 'application/pdf') {
      return await extractTextFromPDF(fileData, fileName);
    } else if (fileType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const text = await fileData.text();
      console.log(`📄 [SUCCESS] Text file extracted, length: ${text.length}`);
      return cleanExtractedText(text);
    } else if (fileType.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      // Use OpenAI for Word documents as well
      return await extractTextFromPDF(fileData, fileName);
    } else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
      try {
        const text = await fileData.text();
        console.log(`📄 [SUCCESS] CSV file extracted, length: ${text.length}`);
        return cleanExtractedText(text);
      } catch (csvError) {
        console.error('📄 [ERROR] CSV extraction failed:', csvError);
        return `[CSV Processing Error: ${fileName} - ${csvError}]`;
      }
    } else {
      // Try to extract as text for unknown types
      try {
        const text = await fileData.text();
        if (text && text.length > 50 && /[a-zA-Z]{3,}/.test(text)) {
          console.log(`📄 [SUCCESS] Unknown file type extracted as text, length: ${text.length}`);
          return cleanExtractedText(text);
        }
      } catch (textError) {
        console.log('📄 [WARNING] Could not extract unknown file type as text:', textError);
      }
      
      return `[Unsupported Document Type: ${fileName} - Type: ${fileType} - Size: ${fileData.size} bytes]

The document type ${fileType} is not yet supported for text extraction.
Supported types: PDF, TXT, MD, DOCX, CSV
Consider converting to a supported format for better processing.`;
    }
  } catch (error) {
    console.error('📄 [ERROR] Document text extraction failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `[Document Processing Error: ${fileName} - ${errorMessage}]`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { filePath, fileName, fileType, bucket = 'chat-files' }: ParseDocumentRequest = await req.json();
    
    console.log('📄 [DEBUG] Parsing document:', { fileName, fileType, bucket, filePath });

    if (!filePath || !fileName || !fileType) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: filePath, fileName, fileType' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from(bucket)
      .download(filePath);

    if (downloadError) {
      console.error('📄 [ERROR] Failed to download file:', downloadError);
      return new Response(JSON.stringify({ 
        error: `Failed to download file: ${downloadError.message}`,
        details: downloadError
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text content from the document
    const extractedText = await extractTextFromDocument(fileData, fileType, fileName);
    
    console.log('📄 [SUCCESS] Document parsed successfully, extracted length:', extractedText.length);

    return new Response(JSON.stringify({
      success: true,
      fileName,
      fileType,
      extractedText,
      metadata: {
        originalSize: fileData.size,
        extractedLength: extractedText.length,
        extractedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('📄 [ERROR] Error in parse-document function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});