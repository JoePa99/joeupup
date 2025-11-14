import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbeddings } from '../_shared/embedding-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessDocumentRequest {
  document_archive_id: string;
  company_id: string;
  user_id: string;
  agent_id?: string;
}

interface DocumentContent {
  content: string;
  metadata: {
    filename: string;
    file_type: string;
    file_size: number;
    extracted_at: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ProcessDocumentRequest = await req.json();
    
    console.log('Processing document for embeddings:', body);

    const { document_archive_id, company_id, user_id, agent_id } = body;

    if (!document_archive_id || !company_id || !user_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Document archive ID, company ID, and user ID are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get document information from document_archives
    const { data: document, error: docError } = await supabase
      .from('document_archives')
      .select('*')
      .eq('id', document_archive_id)
      .eq('company_id', company_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or access denied');
    }

    console.log('Processing document:', document.file_name);

    // Download the document from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    // Extract text content using the enhanced parse-document function
    let documentContent: DocumentContent;
    
    try {
      console.log('📄 [DEBUG] Attempting to use enhanced parse-document function for text extraction');
      const parseResult = await supabase.functions.invoke('parse-document', {
        body: {
          filePath: document.storage_path,
          fileName: document.file_name,
          fileType: document.file_type,
          bucket: 'documents'
        }
      });

      if (parseResult.data?.success && parseResult.data?.extractedText) {
        console.log('📄 [SUCCESS] Enhanced parse-document function extracted text, length:', parseResult.data.extractedText.length);
        
        // Validate extracted content quality
        const extractedText = parseResult.data.extractedText;
        const isValidContent = validateExtractedContent(extractedText, document.file_name);
        
        if (isValidContent) {
          documentContent = {
            content: extractedText,
            metadata: {
              filename: document.file_name,
              file_type: document.file_type,
              file_size: fileData.size,
              extracted_at: new Date().toISOString()
            }
          };
        } else {
          throw new Error('Extracted content failed quality validation');
        }
      } else {
        throw new Error('Parse-document function failed or returned no text');
      }
    } catch (parseError) {
      console.warn('📄 [WARNING] Enhanced parse-document function failed, falling back to basic extraction:', parseError);
      documentContent = await extractDocumentContent(fileData, document.file_type, document.file_name);
      
      // Enhanced content validation for fallback
      if (documentContent.content && !validateExtractedContent(documentContent.content, document.file_name)) {
        console.warn('📄 [WARNING] Fallback extraction produced low-quality content, providing descriptive message');
        documentContent.content = `[Document Processing Notice: Unable to extract readable text from "${document.file_name}". The file may be image-based, password-protected, or in a format that requires specialized processing. File size: ${fileData.size} bytes, Type: ${document.file_type}]`;
      }
    }
    
    if (!documentContent.content || documentContent.content.trim().length === 0) {
      throw new Error('Failed to extract content from document');
    }

    console.log('Extracted content length:', documentContent.content.length);

    // Generate embeddings for the document (handles chunking automatically)
    const embeddings = await generateEmbeddings(documentContent.content, OPENAI_API_KEY);
    
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings');
    }

    console.log(`Generated ${embeddings.length} embeddings, each with ${embeddings[0].length} dimensions`);

    // Delete any existing corrupted documents for this archive before inserting new ones
    console.log('Cleaning up any existing corrupted documents for this archive');
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('document_archive_id', document_archive_id);
    
    if (deleteError) {
      console.warn('Warning: Failed to clean up existing documents:', deleteError);
    }

    // Store document content and embeddings in the Documents table
    // Store the first chunk
    const firstChunkContent = embeddings.length > 1 
      ? documentContent.content.substring(0, 1000) 
      : documentContent.content;

    if (firstChunkContent.trim().length >= 10) {
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          company_id: company_id,
          content: firstChunkContent,
          embedding: embeddings[0],
          agent_id: agent_id || null, // Set agent_id if provided, otherwise accessible by all agents
          document_archive_id: document_archive_id
        });

      if (insertError) {
        console.error('Error inserting first document chunk:', insertError);
        throw new Error('Failed to store document content and embedding');
      }
    }

    // If there are multiple chunks, store additional chunks as separate documents
    if (embeddings.length > 1) {
      console.log(`Storing ${embeddings.length - 1} additional chunks`);
      
      for (let i = 1; i < embeddings.length; i++) {
        const startIndex = Math.max(0, i * 1000 - 50); // Account for overlap, ensure non-negative
        const endIndex = Math.min((i + 1) * 1000, documentContent.content.length);
        const chunkContent = documentContent.content.substring(startIndex, endIndex);
        
        // Skip empty or very short chunks
        if (chunkContent.trim().length < 10) {
          console.log(`Skipping chunk ${i} as it's too short (${chunkContent.trim().length} characters)`);
          continue;
        }
        
        const { error: chunkInsertError } = await supabase
          .from('documents')
          .insert({
            company_id: company_id,
            content: chunkContent,
            embedding: embeddings[i],
            agent_id: agent_id || null,
            document_archive_id: document_archive_id
          });

        if (chunkInsertError) {
          console.warn(`Warning: Failed to store chunk ${i}:`, chunkInsertError);
        }
      }
    }

    // Update document_archives to mark as processed
    const updatedTags = [...(document.tags || []), 'processed', 'embedded'];
    if (agent_id) {
      updatedTags.push(`agent-${agent_id}`);
    }
    
    const { error: updateError } = await supabase
      .from('document_archives')
      .update({ 
        tags: updatedTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', document_archive_id);

    if (updateError) {
      console.warn('Warning: Failed to update document tags:', updateError);
    }

    // If agent_id is provided, create agent_documents relationship
    if (agent_id) {
      const { error: relationError } = await supabase
        .from('agent_documents')
        .insert({
          agent_id: agent_id,
          document_id: document_archive_id
        })
        .select()
        .single();

      if (relationError) {
        // Ignore duplicate key errors (document already linked to agent)
        if (!relationError.message?.includes('duplicate')) {
          console.warn('Warning: Failed to create agent-document relationship:', relationError);
        }
      } else {
        console.log('Created agent-document relationship for agent:', agent_id);
      }
    }

    console.log('Document processed successfully:', document.file_name);

    return new Response(JSON.stringify({
      success: true,
      message: 'Document processed successfully',
      data: {
        document_id: document_archive_id,
        content_length: documentContent.content.length,
        embedding_dimensions: embeddings[0].length,
        total_chunks: embeddings.length,
        filename: document.file_name
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error processing document:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function extractDocumentContent(fileData: Blob, fileType: string, filename: string): Promise<DocumentContent> {
  try {
    let content = '';

    if (fileType === 'text/plain' || fileType === 'text/csv') {
      // Handle text files
      content = await fileData.text();
    } else if (fileType === 'application/pdf') {
      // Handle PDF files
      content = await extractPDFContent(fileData);
    } else if (fileType.includes('word') || fileType.includes('document')) {
      // Handle Word documents
      content = await extractWordContent(fileData);
    } else {
      // For other file types, try to extract as text
      try {
        content = await fileData.text();
      } catch {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    }

    // Clean and normalize content
    content = content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\s{2,}/g, ' ') // Remove excessive whitespace
      .trim();

    // Additional cleaning for very long documents
    if (content.length > 50000) { // If content is very long
      console.log('Content is very long, applying additional cleaning');
      
      // Remove common noise patterns
      content = content
        .replace(/[^\w\s\n.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>]/g, ' ') // Remove special characters
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // More aggressive cleaning for extremely long documents
      if (content.length > 80000) {
        console.log('Content extremely long, applying aggressive cleaning');
        
        // Remove repetitive patterns and reduce whitespace
        content = content
          .replace(/(\w+\s+){10,}/g, (match) => {
            // Keep only first 5 words of very long sequences
            const words = match.trim().split(/\s+/);
            return words.slice(0, 5).join(' ') + ' ';
          })
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // If still too long, truncate intelligently
      if (content.length > 80000) {
        console.log('Content still too long after aggressive cleaning, truncating to first 80k characters');
        content = content.substring(0, 80000);
      }
    }

    return {
      content,
      metadata: {
        filename,
        file_type: fileType,
        file_size: fileData.size,
        extracted_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error extracting document content:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract content from ${filename}: ${errorMessage}`);
  }
}

async function extractPDFContent(fileData: Blob): Promise<string> {
  // For now, we'll use a simple text extraction approach
  // In production, you might want to use a more sophisticated PDF parsing library
  try {
    // Convert to array buffer and try to extract text
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Simple text extraction - look for readable text
    let content = '';
    let inText = false;
    let currentLine = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      
      // Check if byte represents a printable ASCII character
      if (byte >= 32 && byte <= 126) {
        currentLine += String.fromCharCode(byte);
        inText = true;
      } else if (byte === 10 || byte === 13) { // Newline or carriage return
        if (inText && currentLine.trim().length > 0) {
          content += currentLine.trim() + '\n';
          currentLine = '';
        }
        inText = false;
      }
    }
    
    // Add any remaining text
    if (currentLine.trim().length > 0) {
      content += currentLine.trim();
    }
    
    return content || 'PDF content extraction not available';
  } catch (error) {
    console.error('PDF extraction error:', error);
    return 'PDF content extraction failed';
  }
}

async function extractWordContent(fileData: Blob): Promise<string> {
  // For Word documents, we'll return a placeholder
  // In production, you might want to use a library like mammoth.js or similar
  try {
    // Try to extract as text first
    const content = await fileData.text();
    
    // If we get meaningful text, return it
    if (content && content.length > 100 && !content.includes('PK')) {
      return content;
    }
    
    // Otherwise return placeholder
    return 'Word document content extraction not available in this version';
  } catch (error) {
    console.error('Word document extraction error:', error);
    return 'Word document content extraction failed';
  }
}

// Content validation function
function validateExtractedContent(content: string, filename: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  
  const trimmedContent = content.trim();
  
  // Check minimum length
  if (trimmedContent.length < 10) {
    console.log(`📄 [VALIDATION] Content too short: ${trimmedContent.length} characters`);
    return false;
  }
  
  // Check for binary data indicators
  const binaryIndicators = ['%PDF', '\x00', '\x01', '\x02', '\x03', '\x04', '\x05'];
  for (const indicator of binaryIndicators) {
    if (trimmedContent.includes(indicator)) {
      console.log(`📄 [VALIDATION] Binary data detected: ${indicator}`);
      return false;
    }
  }
  
  // Check for excessive non-printable characters
  const nonPrintableCount = (trimmedContent.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
  const nonPrintableRatio = nonPrintableCount / trimmedContent.length;
  if (nonPrintableRatio > 0.3) {
    console.log(`📄 [VALIDATION] Too many non-printable characters: ${nonPrintableRatio.toFixed(2)}`);
    return false;
  }
  
  // Check for meaningful text content
  const wordCount = (trimmedContent.match(/\b[a-zA-Z]{3,}\b/g) || []).length;
  if (wordCount < 3) {
    console.log(`📄 [VALIDATION] Insufficient meaningful words: ${wordCount}`);
    return false;
  }
  
  // Check for error messages or processing notices
  const errorPatterns = [
    /\[PDF Processing Notice/,
    /\[PDF Processing Error/,
    /\[Document Processing Error/,
    /\[Word Document:/,
    /\[Unsupported Document Type/,
    /\[CSV Processing Error/
  ];
  
  for (const pattern of errorPatterns) {
    if (pattern.test(trimmedContent)) {
      console.log(`📄 [VALIDATION] Error message detected in content`);
      return false;
    }
  }
  
  console.log(`📄 [VALIDATION] Content validation passed: ${trimmedContent.length} chars, ${wordCount} words`);
  return true;
}

