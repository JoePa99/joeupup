import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateEmbeddings } from '../_shared/embedding-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessAgentDocumentRequest {
  document_archive_id: string;
  agent_id: string;
  company_id: string;
  user_id: string;
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
    const body: ProcessAgentDocumentRequest = await req.json();
    
    console.log('Processing document for agent with embeddings:', body);

    const { document_archive_id, agent_id, company_id, user_id } = body;

    if (!document_archive_id || !agent_id || !company_id || !user_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All fields are required: document_archive_id, agent_id, company_id, user_id' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get document information
    const { data: document, error: docError } = await supabase
      .from('document_archives')
      .select('*')
      .eq('id', document_archive_id)
      .eq('company_id', company_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or access denied');
    }

    // Get agent information
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vector_store_id, assistant_id, name')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    if (!agent.vector_store_id || !agent.assistant_id) {
      console.warn('Agent missing OpenAI configuration:', { agent_id, vector_store_id: agent.vector_store_id, assistant_id: agent.assistant_id });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Agent is not configured with OpenAI vector store and assistant. Please configure the agent first.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Processing document:', document.file_name, 'for agent:', agent.name);

    // Download the document from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document from storage');
    }

    // STEP 1: Upload to OpenAI Vector Store
    console.log('Step 1: Uploading to OpenAI vector store...');
    
    // Convert blob to array buffer for file upload
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload file to OpenAI
    const formData = new FormData();
    const fileBlob = new Blob([uint8Array], { 
      type: document.file_type || 'application/octet-stream' 
    });
    formData.append('file', fileBlob, document.file_name);
    formData.append('purpose', 'assistants');

    const fileUploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!fileUploadResponse.ok) {
      const errorText = await fileUploadResponse.text();
      console.error('File upload to OpenAI failed:', errorText);
      throw new Error(`Failed to upload file to OpenAI: ${errorText}`);
    }

    const uploadedFile = await fileUploadResponse.json();
    console.log('Document uploaded to OpenAI:', uploadedFile.id);

    // Add file to the agent's vector store
    const vectorStoreFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${agent.vector_store_id}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: uploadedFile.id
      }),
    });

    if (!vectorStoreFileResponse.ok) {
      const errorText = await vectorStoreFileResponse.text();
      console.error('Vector store file addition failed:', errorText);
      throw new Error(`Failed to add file to vector store: ${errorText}`);
    }

    const vectorStoreFile = await vectorStoreFileResponse.json();
    console.log('File added to vector store:', vectorStoreFile.id);

    // STEP 2: Extract content and generate embeddings
    console.log('Step 2: Extracting content and generating embeddings...');
    
    // Extract text content from the document
    const documentContent = await extractDocumentContent(fileData, document.file_type, document.file_name);
    
    if (!documentContent.content || documentContent.content.trim().length === 0) {
      throw new Error('Failed to extract content from document');
    }

    console.log('Extracted content length:', documentContent.content.length);

    // Generate OpenAI embeddings (may return multiple for chunked content)
    const embeddings = await generateEmbeddings(documentContent.content, OPENAI_API_KEY);
    
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Failed to generate embeddings');
    }

    console.log(`Generated ${embeddings.length} embeddings, each with ${embeddings[0].length} dimensions`);

    // STEP 3: Store everything in the database
    console.log('Step 3: Storing in database...');

    // Store document content and embeddings in the documents table
    // For chunked documents, we store multiple rows (one per chunk/embedding)
    const documentRows = embeddings.map((embedding, index) => ({
      company_id: company_id,
      content: documentContent.content, // Store full content for now, could chunk later
      embedding: embedding,
      agent_id: agent_id, // Associate with specific agent
      document_archive_id: document_archive_id
    }));

    const { error: insertEmbeddingError } = await supabase
      .from('documents')
      .insert(documentRows);

    if (insertEmbeddingError) {
      console.error('Error inserting document embeddings:', insertEmbeddingError);
      throw new Error('Failed to store document content and embeddings');
    }

    // Create agent_documents relationship
    const { error: relationError } = await supabase
      .from('agent_documents')
      .insert({
        agent_id: agent_id,
        document_id: document_archive_id
      });

    if (relationError) {
      console.error('Failed to create agent-document relationship:', relationError);
      throw new Error('Failed to create document relationship');
    }

    // Update document_archives to mark as processed for this agent
    const currentTags = document.tags || [];
    const updatedTags = [...currentTags];
    if (!updatedTags.includes('processed')) updatedTags.push('processed');
    if (!updatedTags.includes('embedded')) updatedTags.push('embedded');
    if (!updatedTags.includes(`agent-${agent_id}`)) updatedTags.push(`agent-${agent_id}`);

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

    console.log('Document processed successfully for agent:', agent.name);

    return new Response(JSON.stringify({
      success: true,
      message: `Document successfully processed for agent ${agent.name}`,
      data: {
        document_id: document_archive_id,
        agent_id: agent_id,
        content_length: documentContent.content.length,
        embeddings_count: embeddings.length,
        embedding_dimensions: embeddings[0].length,
        filename: document.file_name,
        agent_name: agent.name,
        note: 'Document uploaded to OpenAI and embeddings stored in database'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error processing document for agent:', error);
    
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
      content = await fileData.text();
    } else if (fileType === 'application/pdf') {
      content = await extractPDFContent(fileData);
    } else if (fileType.includes('word') || fileType.includes('document')) {
      content = await extractWordContent(fileData);
    } else {
      try {
        content = await fileData.text();
      } catch {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    }

    // Clean and normalize content
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (content.length > 50000) {
      console.log('Content is very long, applying additional cleaning');
      content = content
        .replace(/[^\w\s\n.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>]/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (content.length > 80000) {
        console.log('Content extremely long, truncating to first 80k characters');
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
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let content = '';
    let currentLine = '';
    
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      
      if (byte >= 32 && byte <= 126) {
        currentLine += String.fromCharCode(byte);
      } else if (byte === 10 || byte === 13) {
        if (currentLine.trim().length > 0) {
          content += currentLine.trim() + '\n';
          currentLine = '';
        }
      }
    }
    
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
  try {
    const content = await fileData.text();
    
    if (content && content.length > 100 && !content.includes('PK')) {
      return content;
    }
    
    return 'Word document content extraction not available in this version';
  } catch (error) {
    console.error('Word document extraction error:', error);
    return 'Word document content extraction failed';
  }
}

// Note: Embedding generation is now handled by the shared generateEmbeddings function
// from _shared/embedding-config.ts which provides:
// - More accurate token estimation (3.5 chars/token vs 4)
// - Conservative max token limit (4000 vs 8000)
// - Proper chunking for long documents
// - Consistent configuration across all embedding operations