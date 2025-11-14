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

const OPENAI_FILES_ENDPOINT = 'https://api.openai.com/v1/files';
const MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024; // 512 MB (OpenAI limit)
const ASSISTANT_ID = 'asst_LpuVj6mPTIqyOUSmw6eLJdhr';

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  console.log('🏢 [COMPANY-OS-DOC] Uploaded file to OpenAI:', {
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
      console.warn('🏢 [COMPANY-OS-DOC] Warning: Failed to delete OpenAI file:', fileId);
    } else {
      console.log('🏢 [COMPANY-OS-DOC] Deleted OpenAI file:', fileId);
    }
  } catch (error) {
    console.warn('🏢 [COMPANY-OS-DOC] Warning: Error deleting OpenAI file:', error);
  }
}

/**
 * Truncate additional context to fit within OpenAI's message length limit
 * OpenAI has a limit of 256,000 characters for message content
 * We reserve ~50,000 characters for the schema and instructions, leaving ~200,000 for context
 */
function truncateAdditionalContext(context: string, maxLength: number = 200000): string {
  if (context.length <= maxLength) {
    return context;
  }
  
  const truncated = context.substring(0, maxLength);
  const suffix = '\n\n[Note: Additional context was truncated due to length limits. Full document content is available in the attached file.]';
  
  // Find a good breaking point (end of sentence or line)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('.\n\n'),
    truncated.lastIndexOf('\n\n')
  );
  
  if (lastSentenceEnd > maxLength * 0.8) {
    // Use the sentence break if it's not too early
    return truncated.substring(0, lastSentenceEnd + 1) + suffix;
  }
  
  return truncated + suffix;
}

async function createThreadWithMessage(
  fileIds: string[],
  additionalContext: string,
  apiKey: string
): Promise<string> {
  // Truncate additional context if needed to prevent exceeding OpenAI's 256k character limit
  const truncatedContext = additionalContext 
    ? truncateAdditionalContext(additionalContext)
    : '';
  
  if (additionalContext && additionalContext.length > 200000) {
    console.log(`🏢 [COMPANY-OS-DOC] Truncated additional context from ${additionalContext.length} to ${truncatedContext.length} characters`);
  }
  
  const userContent = `Analyze the attached company document and generate a comprehensive CompanyOS JSON object.

${truncatedContext ? `ADDITIONAL CONTEXT:\n${truncatedContext}\n\n` : ''}

Generate a comprehensive CompanyOS JSON object using this exact schema:

{
  "coreIdentityAndStrategicFoundation": {
    "companyOverview": "A brief, high-level summary of the company, its main offerings, and market position.",
    "missionAndVision": {
      "missionStatement": "The company's current official or derived mission statement.",
      "visionStatement": "The company's long-term, aspirational vision statement."
    },
    "coreValues": [
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "coreCompetencies": [
      "Competency 1",
      "Competency 2",
      "Competency 3"
    ],
    "positioningStatement": {
      "targetSegment": "For [specific target audience description]...",
      "category": "who [statement of need or opportunity], [Company Name] is a [market category]...",
      "uniqueBenefit": "that [statement of key benefit].",
      "reasonToBelieve": "Unlike [primary competitive alternative], our product [statement of primary differentiation]."
    },
    "businessModel": {
      "revenueModel": "How the company makes money (e.g., SaaS subscription, direct sales, advertising).",
      "pricingStrategy": "Description of their pricing approach (e.g., Tiered, Per-Seat, Value-Based).",
      "distributionChannels": [
        "Channel 1 (e.g., Direct Sales)",
        "Channel 2 (e.g., Online)"
      ]
    },
    "keyPerformanceIndicators": [
      "KPI 1 (e.g., Customer Lifetime Value - CLV)",
      "KPI 2 (e.g., Customer Acquisition Cost - CAC)",
      "KPI 3 (e.g., Monthly Recurring Revenue - MRR)"
    ],
    "rightToWin": "The single, unique, and defensible advantage the company has over its competition.",
    "swotAnalysis": {
      "strengths": ["Strength 1", "Strength 2", "Strength 3"],
      "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
      "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
      "threats": ["Threat 1", "Threat 2", "Threat 3"]
    }
  },
  "customerAndMarketContext": {
    "idealCustomerProfile": {
      "definingTraits": "Key firmographic/psychographic traits.",
      "keyDemographics": "Demographics of the key buyer/user.",
      "representativePersona": "A brief, narrative persona."
    },
    "customerSegments": [
      {
        "segment": "Segment Name 1",
        "description": "A one-sentence description of this customer group."
      }
    ],
    "customerJourney": {
      "topPainPoints": [
        "Primary customer pain point the product solves.",
        "Secondary pain point.",
        "Tertiary pain point."
      ],
      "topImprovementOpportunities": [
        "Opportunity 1 to improve the customer experience or journey.",
        "Opportunity 2 to improve the customer experience or journey."
      ]
    },
    "marketAnalysis": {
      "primaryCategoryAnalysis": "Analysis of the company's primary market category, including estimated size and key trends.",
      "topDirectCompetitors": [
        "Competitor 1",
        "Competitor 2",
        "Competitor 3"
      ]
    },
    "valuePropositions": [
      {
        "clientType": "Target Segment 1",
        "value": "The unique value delivered to this specific client type."
      }
    ]
  },
  "brandVoiceAndExpression": {
    "brandPurpose": "The 'why' behind the company, beyond making money.",
    "theHotTake": "The company's spicy, controversial, or strong point of view on its industry.",
    "powerfulBeliefs": [
      "We believe [Provocative Belief 1, written as a headline].",
      "We believe [Provocative Belief 2, written as a headline].",
      "We believe [Provocative Belief 3, written as a headline]."
    ],
    "transformation": {
      "from": "The negative state customers are in before the product.",
      "to": "The positive state customers are in after the product."
    },
    "brandVoiceDosAndDonts": {
      "dos": [
        "Be [Adjective 1, e.g., Confident]",
        "Use [Language type, e.g., Simple, direct language]",
        "Always [Action, e.g., Focus on the customer's success]"
      ],
      "donts": [
        "Never be [Adjective 2, e.g., Arrogant]",
        "Avoid [Language type, e.g., Technical jargon]",
        "Don't [Action, e.g., Make unrealistic promises]"
      ]
    },
    "celebrityAnalogue": "The single celebrity (or public figure) who best embodies the company's tone of voice and attitude.",
    "contentStrategy": {
      "pillars": [
        "Pillar 1: A core theme or topic for content creation.",
        "Pillar 2: A core theme or topic for content creation."
      ],
      "keyStrategicImperatives": [
        "Strategic goal for the upcoming year.",
        "Second strategic goal for the upcoming year."
      ]
    }
  }
}

CRITICAL REQUIREMENTS:
- Extract information EXACTLY as it appears in the document, word for word, line by line
- Use DIRECT QUOTES from the document whenever possible
- Extract actual sentences, phrases, and data points from the document text
- NEVER write generic explanations like "The document provides..." or "The document includes..."
- NEVER write meta-commentary about what the document contains
- NEVER write placeholder text or generic descriptions
- Extract actual content only - use what the document SAYS, not descriptions of what it CONTAINS
- When specific data is unavailable in the document, write "Not found in document" or make an educated assumption based on the document content
- Append " (Assumed)" to any values that are assumptions
- Append " (Direct Quote)" to indicate verbatim text from the source
- If information is not found, use "Not found in document" instead of generic placeholders
- Your ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT without markdown formatting or code fences`;

  // Final safety check: ensure content doesn't exceed OpenAI's limit
  const MAX_CONTENT_LENGTH = 256000;
  if (userContent.length > MAX_CONTENT_LENGTH) {
    console.error(`🏢 [COMPANY-OS-DOC] Error: Message content (${userContent.length} chars) exceeds OpenAI limit (${MAX_CONTENT_LENGTH} chars)`);
    // Further truncate if still too long (shouldn't happen, but safety net)
    const excess = userContent.length - MAX_CONTENT_LENGTH + 1000; // Add 1k buffer
    const schemaStart = userContent.indexOf('Generate a comprehensive CompanyOS JSON object');
    if (schemaStart > 0 && excess > 0) {
      const schemaPart = userContent.substring(schemaStart);
      const contextPart = userContent.substring(0, schemaStart);
      const maxContextLength = Math.max(50000, MAX_CONTENT_LENGTH - schemaPart.length - 1000);
      const furtherTruncatedContext = contextPart.substring(0, maxContextLength) + '\n\n[Note: Context was truncated due to length limits. Please refer to the attached document for full content.]';
      const finalContent = furtherTruncatedContext + '\n\n' + schemaPart;
      console.warn(`🏢 [COMPANY-OS-DOC] Applied emergency truncation to ${finalContent.length} chars`);
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
              content: finalContent,
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
    throw new Error(`Message content too long (${userContent.length} chars). Cannot proceed.`);
  }
  
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
          content: userContent,
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
      instructions: `Act as a Senior Strategic Analyst with a world-class consulting firm. Your expertise is in brand strategy, market analysis, and structuring knowledge bases for AI consumption. Your sole task is to analyze the provided company document and extract structured information as a single, complete JSON object.

CRITICAL EXTRACTION RULES:
- You MUST extract information EXACTLY as it appears in the document, word for word, line by line.
- Use DIRECT QUOTES from the document whenever possible. Preserve the exact wording, punctuation, and formatting.
- Extract actual sentences, phrases, and data points from the document text.
- NEVER write generic explanations about what the document "provides" or "includes".
- NEVER write meta-commentary like "The document discusses..." or "The analysis identifies...".
- NEVER write placeholder text or generic descriptions.
- Extract actual content only - use what the document SAYS, not descriptions of what it CONTAINS.
- When you quote directly from the document, preserve the exact text without modification.
- You MUST address every data point requested in the output schema.
- When specific data is unavailable in the document (e.g., internal beliefs, specific KPIs, voice rules), write "Not found in document" or make an educated assumption based on the document's actual content and industry best practices.
- For any value that is an assumption (not explicitly stated in the document), you MUST append the string " (Assumed)" to the end of the text. This is critical for data traceability.
- For any value that is a direct quote from the document, you MUST append the string " (Direct Quote)" to indicate it's verbatim from the source.
- If information is not found, use "Not found in document" instead of generic placeholders or meta-text.
- All content must be specific, actionable, and ready for business use. Avoid vague or generic statements.
- Your ENTIRE RESPONSE MUST BE A SINGLE, VALID JSON OBJECT that conforms precisely to the schema provided. Do not include any conversational text, explanations, markdown formatting, or any characters before or after the opening and closing curly braces {} of the JSON object.`
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
  const maxAttempts = 180; // up to 180 seconds for large/complex documents
  
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
        console.log('🏢 [COMPANY-OS-DOC] Run status:', { attempt: attempt + 1, status: data.status });
      }
    }
    
    if (attempt % 10 === 0) console.log('🏢 [COMPANY-OS-DOC] Waiting for run completion, attempt:', attempt + 1);
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
    console.warn('🏢 [COMPANY-OS-DOC] Warning: Failed to delete thread:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let companyId: string | undefined;
  
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

    console.log('🏢 [COMPANY-OS-DOC] Generating CompanyOS from document:', fileName);
    console.log('🏢 [COMPANY-OS-DOC] File type:', fileType);
    console.log('🏢 [COMPANY-OS-DOC] Company ID:', companyId);

    // Create service role client for database operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update status to 'generating' if record exists
    await supabaseServiceClient
      .from('company_os')
      .update({ status: 'generating' })
      .eq('company_id', companyId);

    // Step 1: Download document from Supabase Storage
    console.log('🏢 [COMPANY-OS-DOC] Downloading document from storage...');
    console.log('🏢 [COMPANY-OS-DOC] Bucket:', bucket, 'Path:', filePath);
    
    const { data: fileData, error: downloadError } = await supabaseServiceClient.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('🏢 [COMPANY-OS-DOC] Storage download error:', downloadError);
      throw new Error(`Failed to download document: ${downloadError?.message || 'Unknown error'}`);
    }

    const fileSize = fileData.size;
    console.log('🏢 [COMPANY-OS-DOC] Document downloaded successfully, size:', fileSize, 'bytes');

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error('File is too large for OpenAI processing. Maximum supported size is 512MB.');
    }

    // Step 2: Upload document to OpenAI and use Assistants API
    let threadId: string | null = null;
    let openAIFileId: string | null = null;
    let runId: string | null = null;
    let result: any;

    try {
      console.log('🏢 [COMPANY-OS-DOC] Uploading document to OpenAI...');
      openAIFileId = await uploadFileToOpenAI({
        file: fileData,
        fileName,
        mimeType: fileType,
        apiKey: openaiApiKey,
      });

      // Step 3: Create thread with document attachment
      console.log('🏢 [COMPANY-OS-DOC] Creating thread with document...');
      threadId = await createThreadWithMessage([openAIFileId], additionalContext, openaiApiKey);
      console.log('🏢 [COMPANY-OS-DOC] Thread created:', threadId);

      // Step 4: Run assistant
      console.log('🏢 [COMPANY-OS-DOC] Running assistant...');
      runId = await createRun(threadId, ASSISTANT_ID, openaiApiKey);
      console.log('🏢 [COMPANY-OS-DOC] Run created:', runId);

      // Step 5: Wait for completion
      console.log('🏢 [COMPANY-OS-DOC] Waiting for assistant to complete...');
      await waitForRunCompletion(threadId, runId, openaiApiKey);
      console.log('🏢 [COMPANY-OS-DOC] Run completed');

      // Step 6: Get response messages
      console.log('🏢 [COMPANY-OS-DOC] Retrieving CompanyOS response...');
      let companyOSContent = await getThreadMessages(threadId, openaiApiKey);
    
    // Sanitize: strip code fences like ```json ... ``` if present
    if (typeof companyOSContent === 'string') {
      const fenceMatch = companyOSContent.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
      if (fenceMatch && fenceMatch[1]) {
        companyOSContent = fenceMatch[1].trim();
      }
      companyOSContent = companyOSContent.trim();
    }

    // Parse the JSON response
    let companyOSData;
    try {
      companyOSData = JSON.parse(companyOSContent);
    } catch (parseError) {
      console.error('🏢 [COMPANY-OS-DOC] Failed to parse response as JSON:', parseError);
      console.error('🏢 [COMPANY-OS-DOC] Raw content:', companyOSContent.substring(0, 500));
      throw new Error('Failed to parse CompanyOS response. Please try again.');
    }

    // Validate that we have the required top-level keys
    const requiredKeys = ['coreIdentityAndStrategicFoundation', 'customerAndMarketContext', 'brandVoiceAndExpression'];
    const missingKeys = requiredKeys.filter(key => !companyOSData[key]);
    
    if (missingKeys.length > 0) {
      console.error('🏢 [COMPANY-OS-DOC] Missing required keys:', missingKeys);
      throw new Error(`Generated CompanyOS is missing required sections: ${missingKeys.join(', ')}`);
    }

      // Step 7: Store in database using service role
    // Check if CompanyOS already exists for this company
      const { data: existingOS, error: existingOSError } = await supabaseServiceClient
      .from('company_os')
        .select('id, version, metadata')
      .eq('company_id', companyId)
        .maybeSingle();

      // Don't throw if no existing record found - that's fine, we'll create a new one
      if (existingOSError && existingOSError.code !== 'PGRST116') {
        throw existingOSError;
      }

    if (existingOS) {
      // Update existing CompanyOS
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .update({
          os_data: companyOSData,
          version: (existingOS.version || 1) + 1,
          last_updated: new Date().toISOString(),
          generated_by: user.id,
          source_url: null,
            status: 'completed',
          metadata: {
              ...existingOS.metadata,
            source_type: 'document_upload',
            source_document: {
              fileName,
              filePath,
              fileType,
                fileSize,
              uploadedAt: new Date().toISOString()
            },
            additionalContext,
              document_summary: additionalContext || existingOS.metadata?.document_summary || null,
              regenerated_at: new Date().toISOString(),
              generation_method: 'openai_assistants_api',
              openai_file_id: openAIFileId,
              openai_thread_id: threadId,
              openai_run_id: runId
          }
        })
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS-DOC] Updated existing CompanyOS, new version:', result.version);
    } else {
      // Insert new CompanyOS
      const { data, error } = await supabaseServiceClient
        .from('company_os')
        .insert({
          company_id: companyId,
          os_data: companyOSData,
          version: 1,
          generated_by: user.id,
          source_url: null,
            status: 'completed',
          metadata: {
            source_type: 'document_upload',
            source_document: {
              fileName,
              filePath,
              fileType,
                fileSize,
              uploadedAt: new Date().toISOString()
            },
            additionalContext,
              document_summary: additionalContext || null,
              generated_at: new Date().toISOString(),
              generation_method: 'openai_assistants_api',
              openai_file_id: openAIFileId,
              openai_thread_id: threadId,
              openai_run_id: runId
          }
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
      console.log('🏢 [COMPANY-OS-DOC] Created new CompanyOS');
      }

    } finally {
      // Cleanup OpenAI resources
      if (openAIFileId) {
        await deleteOpenAIFile(openAIFileId, openaiApiKey);
      }
      if (threadId) {
        await cleanupThread(threadId, openaiApiKey);
      }
    }

    const executionTime = Date.now() - startTime;

    console.log('🏢 [COMPANY-OS-DOC] Generation completed successfully');
    console.log(`🏢 [COMPANY-OS-DOC] Execution time: ${executionTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      companyOS: result,
      metadata: {
        fileName,
        sourceType: 'document_upload',
        generated_at: new Date().toISOString(),
        execution_time: executionTime,
        model: 'openai_assistants_api'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('🏢 [COMPANY-OS-DOC] Error:', error);
    
    // Update status to 'failed' if record exists
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
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

