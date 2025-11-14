import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { generateQueryEmbedding } from '../_shared/embedding-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch conversation history for context
async function fetchConversationHistory(
  supabaseClient: any, 
  conversationId: string, 
  limit: number = 25
) {
  const { data: messages } = await supabaseClient
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .is('channel_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  return messages?.map((msg: any) => ({
    role: msg.role,
    content: msg.content
  })) || [];
}

// Generate image using configured AI provider and store in Supabase Storage
async function generateImageWithDALLE(
  params: { prompt: string; size?: string; quality?: string },
  supabaseClient: any,
  agentConfig?: { ai_provider?: string; ai_model?: string }
) {
  const startTime = Date.now();
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
    return {
      success: false,
      error: 'Missing required environment variables'
    };
  }

  try {
    const aiProvider = agentConfig?.ai_provider || 'openai';
    const aiModel = agentConfig?.ai_model || 'gpt-image-1';

    // Determine image generation strategy
    // Valid OpenAI image models
    const validImageModels = ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-0721-mini-alpha', 'dall-e-2', 'dall-e-3'];
    
    // Claude/Anthropic and Google/Gemini models cannot generate images via their APIs
    // Also check if OpenAI model is actually an image generation model
    const needsFallback = aiProvider === 'anthropic' || 
                          aiProvider === 'google' || 
                          (aiProvider === 'openai' && !validImageModels.includes(aiModel));

    if (aiProvider === 'anthropic') {
      console.log(`Anthropic/Claude models cannot generate images - falling back to OpenAI DALL-E (gpt-image-1)`);
    } else if (aiProvider === 'google') {
      console.log(`Google/Gemini models cannot generate images without additional setup - falling back to OpenAI DALL-E (gpt-image-1)`);
    } else if (aiProvider === 'openai' && !validImageModels.includes(aiModel)) {
      console.log(`Model "${aiModel}" is not an image generation model - falling back to OpenAI DALL-E (gpt-image-1)`);
    }

    console.log(`Generating image with provider="${aiProvider}", model="${aiModel}", needsFallback=${needsFallback}`);

    // Use OpenAI DALL-E API for all image generation
    let imageResponse;
    
    const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: needsFallback ? 'gpt-image-1' : (aiModel || 'gpt-image-1'),
        prompt: params.prompt,
        size: params.size || '1024x1024',
        quality: params.quality || 'high',
        n: 1
      }),
    });

    if (!dalleResponse.ok) {
      const errorData = await dalleResponse.json().catch(() => ({}));
      console.error('DALL-E API error:', errorData);
      return {
        success: false,
        error: `DALL-E API error: ${dalleResponse.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    imageResponse = await dalleResponse.json();
    console.log('DALL-E response received');

    // Handle image data
    const imageData = imageResponse.data[0];
    const revisedPrompt = imageData.revised_prompt || params.prompt;
    
    // Image should have base64 data
    if (!imageData.b64_json) {
      return {
        success: false,
        error: 'No image data received from AI provider'
      };
    }

    // Convert base64 to Uint8Array
    const base64Data = imageData.b64_json;
    const binaryString = atob(base64Data);
    const imageUint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      imageUint8Array[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const { data: { user } } = await supabaseClient.auth.getUser();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `generated-image-${user?.id || 'unknown'}-${timestamp}.png`;
    const filePath = `generated-images/${filename}`;

    // Create service role client for storage operations
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.55.0');
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('chat-attachments')
      .upload(filePath, imageUint8Array, {
        contentType: 'image/png',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Failed to upload image:', uploadError);
      return {
        success: false,
        error: 'Failed to store generated image'
      };
    }

    // Get public URL
    const { data: urlData } = supabaseService.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    console.log('Image generated and stored successfully');

    return {
      success: true,
      images: [{
        url: urlData.publicUrl,
        revised_prompt: revisedPrompt,
        storage_path: filePath
      }],
      metadata: {
        original_prompt: params.prompt,
        size: params.size || '1024x1024',
        quality: params.quality || 'high',
        model: `${aiProvider}/${aiModel}`,
        generated_at: new Date().toISOString(),
        execution_time: Date.now() - startTime
      }
    };

  } catch (error) {
    console.error('Error in generateImageWithDALLE:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Main chat processing function
async function processUserMessage(
  message: string,
  agentId: string,
  conversationId: string,
  supabaseClient: any,
  userId: string,
  attachments: any[] = []
): Promise<{ response: string; analysis: any; content_type?: string; tool_results_data?: any }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log(`Processing message for agent ${agentId}: "${message}"`);

  // Check usage limit before processing message
  try {
    const { data: usageData, error: usageError } = await supabaseClient
      .rpc('get_user_current_usage', { p_user_id: userId });

    if (usageError) {
      console.error('Error checking usage:', usageError);
      // Don't block the user if usage check fails, let the trigger handle it
    } else if (usageData && usageData.length > 0) {
      const usage = usageData[0];
      if (usage.messages_used >= usage.messages_limit) {
        throw new Error(
          `You have reached your message limit (${usage.messages_limit} messages). ` +
          `Please upgrade your plan or wait for your next billing period to continue.`
        );
      }
      
      // Warn if approaching limit (>90%)
      const percentage = (usage.messages_used / usage.messages_limit) * 100;
      if (percentage >= 90) {
        console.log(`Warning: User ${userId} is at ${percentage.toFixed(0)}% of their message limit`);
      }
    }
  } catch (error) {
    // If it's a limit exceeded error, rethrow it
    if (error.message && error.message.includes('message limit')) {
      throw error;
    }
    // Otherwise, log and continue (trigger will catch it)
    console.error('Usage check failed:', error);
  }

  // Fetch conversation history for context (last 12 messages)
  const conversationHistory = await fetchConversationHistory(supabaseClient, conversationId, 25);
  console.log(`Fetched ${conversationHistory.length} previous conversation messages for context (limit: 25)`);

  // Step 1: Analyze user intent with conversation context
  const { data: intentData, error: intentError } = await supabaseClient.functions.invoke('intent-analyzer', {
    body: { message, agentId, conversationHistory, attachments }
  });

  if (intentError) {
    console.error('Intent analysis failed:', intentError);
    throw new Error('Failed to analyze user intent');
  }

  const analysis = intentData;
  console.log('Intent Analysis:', JSON.stringify(analysis, null, 2));
  
  // Check if we need to trigger rich content generation
  if (analysis.action_type === 'long_rich_text' && attachments && attachments.length > 0) {
    console.log('🔍 [DEBUG] Long rich text detected with attachments - triggering generate-rich-content');
    
    // Read document content from the first attachment
    const attachment = attachments[0];
    console.log('🔍 [DEBUG] Processing attachment:', attachment.name, 'at path:', attachment.path);
    
    try {
      // Download and read the document content from Supabase storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('chat-files')
        .download(attachment.path);
      
      if (downloadError) {
        console.error('🔍 [DEBUG] Error downloading file:', downloadError);
        // Create error message for user instead of falling through
        const { error: errorMessageInsert } = await supabaseClient
          .from('chat_messages')
          .insert({
            content: `❌ Unable to access the document "${attachment.name}". Please try uploading the file again or contact support if the issue persists.`,
            role: 'assistant',
            conversation_id: conversationId,
            channel_id: null,
            message_type: 'direct',
            agent_id: agentId
          });
        
        if (errorMessageInsert) {
          console.error('🔍 [DEBUG] Error creating error message:', errorMessageInsert);
        }
        
        return {
          response: `I encountered an error accessing the document "${attachment.name}". Please try uploading it again.`,
          analysis: {
            ...analysis,
            error: 'Document access failed',
            attachment_name: attachment.name
          }
        };
      }
      
      // Create placeholder message BEFORE attempting to parse
      const { data: messageData, error: messageError } = await supabaseClient
        .from('chat_messages')
        .insert({
          content: `📄 Processing document "${attachment.name}"...`,
          role: 'assistant',
          conversation_id: conversationId,
          channel_id: null,
          message_type: 'direct',
          agent_id: agentId,
          is_generating: true,
          generation_progress: 0,
          content_type: 'document_analysis'
        })
        .select()
        .single();
      
      if (messageError || !messageData) {
        console.error('🔍 [DEBUG] Error creating placeholder message:', messageError);
        return {
          response: `I encountered an error processing "${attachment.name}". Please try again.`,
          analysis: {
            ...analysis,
            error: 'Failed to create placeholder message'
          }
        };
      }
      
      console.log('🔍 [DEBUG] Created placeholder message:', messageData.id);
      
      // Extract text content using the new parse-document function
      const { data: parseResult, error: parseError } = await supabaseClient.functions.invoke('parse-document', {
        body: {
          filePath: attachment.path,
          fileName: attachment.name,
          fileType: attachment.type,
          bucket: 'chat-files'
        }
      });
      
      if (parseError || !parseResult.success) {
        console.error('🔍 [DEBUG] Error parsing document:', parseError || parseResult);
        
        // Update the placeholder message to show error state with retry option
        const { error: updateError } = await supabaseClient
          .from('chat_messages')
          .update({
            is_generating: false,
            generation_progress: 0,
            content: `❌ Failed to parse "${attachment.name}"`,
            content_title: 'Document Parsing Failed',
            content_type: 'document_analysis',
            content_metadata: {
              error: true,
              error_message: parseError?.message || parseResult?.error || 'The document parsing timed out or encountered an error. This might be due to document complexity, size, or API load.',
              can_retry: true,
              attachment_path: attachment.path,
              attachment_name: attachment.name,
              attachment_type: attachment.type
            }
          })
          .eq('id', messageData.id);
        
        if (updateError) {
          console.error('Error updating message with error state:', updateError);
        }
        
        return {
          response: `I encountered an error parsing "${attachment.name}". The document might be too complex or large. You can try uploading it again or use a simpler format.`,
          analysis: {
            ...analysis,
            error: 'Document parsing failed',
            attachment_name: attachment.name
          }
        };
      }
      
      const documentContent = parseResult.extractedText;
      
      console.log('🔍 [DEBUG] Document content extracted successfully, length:', documentContent.length);
      
      // Update the placeholder message with progress
      const { error: progressUpdateError } = await supabaseClient
        .from('chat_messages')
        .update({
          content: `📄 Analyzing document "${attachment.name}"...`,
          is_generating: true,
          generation_progress: 5,
          content_title: `Analyzing ${attachment.name}`
        })
        .eq('id', messageData.id);
      
      if (progressUpdateError) {
        console.error('🔍 [DEBUG] Error updating progress:', progressUpdateError);
      }
      
      console.log('🔍 [DEBUG] Created placeholder message:', messageData.id);
      
      // Trigger rich content generation asynchronously
      const richContentPromise = supabaseClient.functions.invoke('generate-rich-content', {
        body: {
          messageId: messageData.id,
          userMessage: message,
          agentId: agentId,
          documentContent: documentContent,
          documentName: attachment.name,
          conversationId: conversationId
        }
      });
      
      // Don't await - let it process in background
      richContentPromise.catch((error: any) => {
        console.error('🔍 [DEBUG] Rich content generation failed:', error);
      });
      
      console.log('🔍 [DEBUG] Triggered generate-rich-content function');
      
      // Return early with a quick acknowledgment
      return {
        response: `I'm analyzing the document "${attachment.name}". This will take a moment...`,
        analysis: {
          ...analysis,
          document_processing: true,
          attachment_name: attachment.name
        }
      };
      
    } catch (error) {
      console.error('🔍 [DEBUG] Error processing attachment:', error);
      // Fall through to normal processing if document reading fails
    }
  }

  let contextData = '';
  let toolResults: any[] = [];

  // Step 2: Execute tools if needed
  if (analysis.action_type === 'tool' || analysis.action_type === 'both') {
    if (analysis.tools_required && analysis.tools_required.length > 0) {
      console.log('Executing tools...');
      
      for (const tool of analysis.tools_required) {
        try {
          const { data: toolResult, error: toolError } = await supabaseClient.functions.invoke('agent-tools-executor', {
            body: {
              agentId,
              toolId: tool.tool_id,
              action: tool.action,
              parameters: tool.parameters
            }
          });

          if (toolError) {
            console.error(`Tool execution failed for ${tool.tool_id}:`, toolError);
            toolResults.push({
              tool_id: tool.tool_id,
              success: false,
              error: toolError.message
            });
          } else {
            toolResults.push(toolResult);
            
            // Special handling for web research results
            if (toolResult.metadata?.content_type === 'web_research') {
              console.log('🔍 [WEB RESEARCH] Processing web research results');
              console.log('🔍 [WEB RESEARCH] Sources found:', toolResult.metadata?.sources_count);
              console.log('🔍 [WEB RESEARCH] Perplexity model used:', toolResult.metadata?.perplexity_model);
              
              // Format web research results with rich context
              const researchData = toolResult.results?.research;
              if (researchData) {
                contextData += `\n\n[Web Research Results - Powered by Perplexity]:\n`;
                contextData += `Query: ${researchData.query}\n`;
                contextData += `Summary: ${researchData.summary}\n`;
                
                if (researchData.sections && researchData.sections.length > 0) {
                  contextData += `\nDetailed Analysis:\n`;
                  researchData.sections.forEach((section: any, index: number) => {
                    contextData += `${index + 1}. ${section.title}\n${section.content}\n\n`;
                  });
                }
                
                if (researchData.key_insights && researchData.key_insights.length > 0) {
                  contextData += `Key Insights:\n`;
                  researchData.key_insights.forEach((insight: any) => {
                    contextData += `- ${insight}\n`;
                  });
                  contextData += `\n`;
                }
                
                if (researchData.sources && researchData.sources.length > 0) {
                  contextData += `Sources (${researchData.sources.length}):\n`;
                  researchData.sources.forEach((source: any, index: number) => {
                    contextData += `${index + 1}. ${source.title} - ${source.url}\n`;
                  });
                }
              }
            } else {
              // Standard tool result formatting
              contextData += `\n\n[${toolResult.tool_id} Results]: ${toolResult.summary}\n${JSON.stringify(toolResult.results, null, 2)}`;
            }
          }
        } catch (error) {
          console.error(`Tool execution error for ${tool.tool_id}:`, error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          toolResults.push({
            tool_id: tool.tool_id,
            success: false,
            error: errorMessage
          });
        }
      }
    }
  }

  // Step 3: Perform document search if needed (with fallback for knowledge queries)
  const shouldSearchDocs = 
    analysis.action_type === 'document_search' || 
    analysis.action_type === 'both' ||
    /\b(sop|standard operating procedure|policy|procedure|handbook|guidelines|company doc|knowledge base)\b/i.test(message);

  if (shouldSearchDocs) {
    const searchQuery = analysis.document_search_query || message;
    console.log('Performing document search with query:', searchQuery);
    
    try {
      // Get user's company info for document access
      const { data: userProfile } = await supabaseClient
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .single();

      if (userProfile?.company_id) {
        console.log(`Searching documents for company: ${userProfile.company_id}`);
        
        // Get company's Google Drive folder (if configured)
        const { data: companyData } = await supabaseClient
          .from('companies')
          .select('google_drive_folder_id, google_drive_folder_name')
          .eq('id', userProfile.company_id)
          .single();
        
        try {
          // Generate embedding for Supabase vector search
          const queryEmbedding = await generateQueryEmbedding(searchQuery, openaiApiKey);
          console.log('Generated embedding for document search');
          
          // PARALLEL SEARCH: Supabase documents + Google Drive files
          const searchPromises = [
            // Existing Supabase vector search
            supabaseClient.rpc('match_documents', {
              query_embedding: queryEmbedding,
              match_threshold: 0.25,
              match_count: 5,
              p_company_id: userProfile.company_id,
              p_agent_id: agentId
            })
          ];
          
          // Add Google Drive search if folder is configured
          if (companyData?.google_drive_folder_id) {
            console.log('🔍 [GOOGLE-DRIVE] Including Google Drive search for folder:', companyData.google_drive_folder_name);
            searchPromises.push(
              supabaseClient.functions.invoke('search-google-drive-files', {
                body: {
                  query: searchQuery,
                  folderId: companyData.google_drive_folder_id,
                  maxResults: 5
                }
              })
            );
          } else {
            console.log('🔍 [GOOGLE-DRIVE] No Google Drive folder configured, skipping Google Drive search');
            searchPromises.push(Promise.resolve({ data: null }));
          }
          
          const [supabaseResults, googleDriveResults] = await Promise.all(searchPromises);
          
          // Process Supabase results (existing logic)
          if (supabaseResults.data && supabaseResults.data.length > 0) {
            console.log(`Found ${supabaseResults.data.length} Supabase documents`);
            const maxContentLength = supabaseResults.data.length <= 3 ? 20000 : 10000;
            const supabaseDocs = supabaseResults.data.map((doc: any) => {
              const trimmedContent = doc.content.length > maxContentLength 
                ? doc.content.substring(0, maxContentLength) + '...' 
                : doc.content;
              return {
                source: 'supabase',
                fileName: doc.file_name,
                content: trimmedContent,
                similarity: doc.similarity
              };
            });
            
            contextData += supabaseDocs.map(doc => 
              `Source: Supabase Document\nDocument: ${doc.fileName}\nContent: ${doc.content}\nSimilarity: ${doc.similarity.toFixed(3)}`
            ).join('\n\n---\n\n');
            console.log('Retrieved relevant documents from Supabase vector search');
          } else {
            console.log('No relevant documents found in Supabase vector search');
          }
          
          // Process Google Drive results (NEW)
          if (googleDriveResults?.data?.files && googleDriveResults.data.files.length > 0) {
            console.log(`🔍 [GOOGLE-DRIVE] Found ${googleDriveResults.data.files.length} Google Drive files`);
            
            // Fetch content for top 3 files only (to avoid timeouts)
            const filesToFetch = googleDriveResults.data.files.slice(0, 3);
            const contentPromises = filesToFetch.map((file: any) => 
              supabaseClient.functions.invoke('fetch-google-drive-file-content', {
                body: {
                  fileId: file.id,
                  mimeType: file.mimeType,
                  fileName: file.name
                }
              }).catch(err => {
                console.error(`🔍 [GOOGLE-DRIVE] Failed to fetch content for ${file.name}:`, err);
                return { data: null };
              })
            );
            
            const contentResults = await Promise.all(contentPromises);
            
            // Add successfully fetched files to context
            contentResults.forEach((result, idx) => {
              if (result.data?.success && result.data?.content) {
                const file = filesToFetch[idx];
                if (contextData) contextData += '\n\n---\n\n';
                contextData += `Source: Google Drive\nDocument: ${file.name}\nLink: ${file.webViewLink}\nContent: ${result.data.content}`;
              }
            });
            
            console.log('🔍 [GOOGLE-DRIVE] Retrieved content from Google Drive files');
          } else {
            console.log('🔍 [GOOGLE-DRIVE] No Google Drive files found');
          }
          
          // Fallback: Try OpenAI Assistant file_search if no results from either source
          if (!contextData || contextData.trim() === '') {
            console.log('Attempting fallback file search via OpenAI Assistant...');
            const { data: agentVectorStore } = await supabaseClient
              .from('agents')
              .select('vector_store_id, assistant_id')
              .eq('id', agentId)
              .single();
            
            if (agentVectorStore?.vector_store_id && agentVectorStore?.assistant_id) {
              try {
                // Use AI provider service with file_search enabled
                const fallbackResponse = await supabaseClient.functions.invoke('ai-provider-service', {
                  body: {
                    provider: 'openai',
                    model: 'gpt-4o',
                    messages: [
                      {
                        role: 'system',
                        content: `You are a document search assistant. Search your knowledge base for information related to: "${searchQuery}". Return only relevant excerpts from documents, formatted as:

Document: [filename]
Content: [relevant excerpt]

If no relevant documents are found, respond with "No relevant documents found in knowledge base."`
                      },
                      {
                        role: 'user',
                        content: `Search for information about: ${searchQuery}`
                      }
                    ],
                    max_tokens: 1000,
                    temperature: 0.1,
                    tools: [{ type: 'file_search' }],
                    tool_resources: {
                      file_search: {
                        vector_store_ids: [agentVectorStore.vector_store_id]
                      }
                    }
                  }
                });

                if (fallbackResponse.data?.choices?.[0]?.message?.content) {
                  const fallbackContent = fallbackResponse.data.choices[0].message.content;
                  if (!fallbackContent.includes('No relevant documents found')) {
                    contextData += `\n\n[Fallback Document Search Results]: ${fallbackContent}`;
                    console.log('Fallback file search found relevant documents');
                  } else {
                    console.log('Fallback file search also found no relevant documents');
                  }
                }
              } catch (fallbackError) {
                console.error('Fallback file search failed:', fallbackError);
              }
            } else {
              console.log('Agent has no vector store configured for fallback search');
            }
          }
        } catch (embeddingError) {
          console.error('Failed to generate embedding for search query:', embeddingError);
        }
      } else {
        console.log('User has no company configured, skipping document search');
      }
    } catch (error) {
      console.error('Error during document search:', error);
    }
  }

  // Step 4: Get agent information for system instructions and AI config
  const { data: agentData, error: agentError } = await supabaseClient
    .from('agents')
    .select('name, description, configuration, company_id')
    .eq('id', agentId)
    .single();

  if (agentError) {
    console.error('Failed to fetch agent data:', agentError);
    throw new Error('Failed to fetch agent information');
  }

  // Extract AI configuration with defaults
  const aiProvider = agentData.configuration?.ai_provider || 'openai';
  const aiModel = agentData.configuration?.ai_model || 'gpt-4o';
  const maxTokens = agentData.configuration?.max_tokens || 4000; // Increased default for better context handling
  const webAccess = agentData.configuration?.web_access || false;

  console.log(`Using AI: ${aiProvider}/${aiModel} (max_tokens: ${maxTokens}, web_access: ${webAccess})`);

  // Determine selected model early (needed for document attachment check)
  const selectedModel = webAccess && aiProvider === 'openai' ? 'gpt-4o-search-preview' : aiModel;

  // Step 4.5: Fetch CompanyOS for enhanced context
  let companyOSContext = '';
  let documentAttachment: any = null;
  let documentSummary = '';
  
  if (agentData.company_id) {
    try {
      const { data: companyOS, error: osError } = await supabaseClient
        .from('company_os')
        .select('os_data, raw_scraped_text, metadata')
        .eq('company_id', agentData.company_id)
        .single();

      if (!osError && companyOS?.os_data) {
        console.log('🏢 [COMPANY-OS] Found CompanyOS for company, formatting context...');
        
        // Fetch document summary from metadata
        documentSummary = companyOS.metadata?.document_summary || '';
        
        // Format CompanyOS as structured context
        const osData = companyOS.os_data;
        const core = osData.coreIdentityAndStrategicFoundation;
        const market = osData.customerAndMarketContext;
        const brand = osData.brandVoiceAndExpression;

        // Create a concise, well-formatted context (optimized for token efficiency)
        companyOSContext = `
# COMPANY CONTEXT (CompanyOS)

## Core Identity
${core.companyOverview}

**Mission:** ${core.missionAndVision.missionStatement}
**Vision:** ${core.missionAndVision.visionStatement}
**Values:** ${core.coreValues.join(', ')}
**Right to Win:** ${core.rightToWin}

## Market Position
**Target:** ${core.positioningStatement.targetSegment}
**Unique Benefit:** ${core.positioningStatement.uniqueBenefit}
**ICP:** ${market.idealCustomerProfile.definingTraits}
**Key Competitors:** ${market.marketAnalysis.topDirectCompetitors.join(', ')}

## Brand Voice
**Purpose:** ${brand.brandPurpose}
**Transformation:** ${brand.transformation.from} → ${brand.transformation.to}
**Voice Style:** ${brand.celebrityAnalogue}
**Do's:** ${brand.brandVoiceDosAndDonts.dos.join('; ')}
**Don'ts:** ${brand.brandVoiceDosAndDonts.donts.join('; ')}
**Beliefs:** ${brand.powerfulBeliefs.join(' | ')}

## Customer Pain Points
${market.customerJourney.topPainPoints.join('; ')}

## Value Propositions
${market.valuePropositions.map(vp => `${vp.clientType}: ${vp.value}`).join(' | ')}
`;

        // Add document summary if available
        if (documentSummary) {
          companyOSContext += `\n\n## Document Summary
${documentSummary}
`;
          console.log('🏢 [COMPANY-OS] Added document summary, length:', documentSummary.length);
        }

        // Add raw scraped text if available (from document uploads) - for backward compatibility
        if (companyOS.raw_scraped_text && companyOS.metadata?.source_type === 'document_upload' && !documentSummary) {
          companyOSContext += `\n\n## Source Document Text
Document: ${companyOS.metadata?.source_document?.fileName || 'Unknown'}

The following is the raw text extracted from the uploaded document:

${companyOS.raw_scraped_text}
`;
          console.log('🏢 [COMPANY-OS] Added raw document text, length:', companyOS.raw_scraped_text.length);
        }
        
        // Check if we should attach the document file
        const sourceDocument = companyOS.metadata?.source_document;
        if (sourceDocument?.filePath && aiProvider === 'openai') {
          // Check if model supports file attachments (OpenAI models with file_search capability)
          const modelsWithFileSearch = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-4o-2024-08-06', 'gpt-4-turbo-2024-04-09'];
          const supportsAttachments = modelsWithFileSearch.includes(selectedModel) || modelsWithFileSearch.includes(aiModel);
          
          if (supportsAttachments) {
            try {
              console.log('🏢 [COMPANY-OS] Model supports file attachments, uploading document...');
              
              // Download document from Supabase Storage
              const { data: fileData, error: downloadError } = await supabaseClient.storage
                .from(sourceDocument.bucket || 'documents')
                .download(sourceDocument.filePath);
              
              if (!downloadError && fileData) {
                // Upload to OpenAI
                const formData = new FormData();
                formData.append('purpose', 'assistants');
                const fileWithName = new File([fileData], sourceDocument.fileName || 'document.pdf', { 
                  type: sourceDocument.fileType || 'application/pdf' 
                });
                formData.append('file', fileWithName);
                
                const uploadResponse = await fetch('https://api.openai.com/v1/files', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                  },
                  body: formData,
                });
                
                if (uploadResponse.ok) {
                  const uploadData = await uploadResponse.json();
                  documentAttachment = {
                    file_id: uploadData.id,
                    tools: [{ type: 'file_search' }]
                  };
                  console.log('🏢 [COMPANY-OS] Document uploaded to OpenAI, file ID:', uploadData.id);
                } else {
                  console.warn('🏢 [COMPANY-OS] Failed to upload document to OpenAI');
                }
              }
            } catch (attachError) {
              console.error('🏢 [COMPANY-OS] Error attaching document:', attachError);
              // Don't fail if document attachment fails
            }
          }
        }
        
        console.log('🏢 [COMPANY-OS] CompanyOS context added, length:', companyOSContext.length);
      } else {
        console.log('🏢 [COMPANY-OS] No CompanyOS found for this company');
      }
    } catch (error) {
      console.error('🏢 [COMPANY-OS] Error fetching CompanyOS:', error);
      // Don't fail the request if CompanyOS fetch fails
    }
  }

  // Build system prompt from agent's configuration
  let systemPrompt = agentData.configuration?.instructions || 
    `You are ${agentData.name}. ${agentData.description}`;
  
  // Add CompanyOS context first (highest priority)
  if (companyOSContext) {
    systemPrompt += `\n\n${companyOSContext}\n\nIMPORTANT: Use this CompanyOS context to inform all your responses. Align your tone, language, and recommendations with the company's brand voice, values, and strategic positioning. When relevant, reference the company's mission, value propositions, and customer pain points.`;
  }
  
  // Add document search context if available
  if (contextData) {
    console.log('🔍 [DEBUG] Adding document context to system prompt, length:', contextData.length);
    console.log('🔍 [DEBUG] Context data preview:', contextData.substring(0, 500) + '...');
    systemPrompt += `\n\nRELEVANT DOCUMENTS: Use the following context information to answer the user's question. This context contains relevant documents from both our database and Google Drive that should be used to provide accurate, specific answers:\n\n${contextData}\n\nWhen answering, prioritize information from this context over general knowledge. If the context contains specific procedures, steps, or details, use them directly in your response. If documents are from Google Drive, you can reference them by name and provide the link if helpful.`;
  } else {
    console.log('🔍 [DEBUG] No document context available for system prompt');
  }

  // Prepare final messages with last 12 conversation messages
  const finalMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,  // Last 12 messages
  ];
  
  // Add user message with document attachment if available
  const userMessage: any = { role: 'user', content: message };
  if (documentAttachment) {
    userMessage.attachments = [documentAttachment];
    console.log('🏢 [COMPANY-OS] Adding document attachment to user message');
  }
  finalMessages.push(userMessage);
  
  console.log('🔍 [DEBUG] Final system prompt length:', systemPrompt.length);
  console.log('🔍 [DEBUG] System prompt preview:', systemPrompt.substring(0, 800) + '...');

  // Define the image generation function for GPT-4o
  const imageGenerationFunction = {
    type: "function",
    function: {
      name: "generate_image",
      description: "Generate an image using OpenAI Images (gpt-image-1) based on a text prompt",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "A detailed description of the image to generate"
          },
          size: {
            type: "string",
            enum: ["1024x1024", "1792x1024", "1024x1792"],
            default: "1024x1024",
            description: "The size of the generated image"
          },
          quality: {
            type: "string",
            enum: ["auto", "hd"],
            default: "auto", 
            description: "The quality of the generated image"
          }
        },
        required: ["prompt"]
      }
    }
  };

  // Step 5: Call AI Provider Service
  
  // gpt-4o-search-preview doesn't support function calling (tools)
  // Only add functions for models that support it
  const requestBody: any = {
    provider: aiProvider,
    model: selectedModel,
    messages: finalMessages,
    max_tokens: maxTokens,
    temperature: 0.7,
    web_access: webAccess,
  };

  // Don't add functions for gpt-4o-search-preview
  if (selectedModel !== 'gpt-4o-search-preview') {
    requestBody.functions = [imageGenerationFunction];
  }

  console.log('🔍 [DEBUG] Sending request to AI provider service with', finalMessages.length, 'messages');
  console.log('🔍 [DEBUG] Request body preview:', JSON.stringify({
    provider: requestBody.provider,
    model: requestBody.model,
    max_tokens: requestBody.max_tokens,
    message_count: requestBody.messages.length,
    system_prompt_length: requestBody.messages[0]?.content?.length || 0
  }, null, 2));
  
  const { data: aiResponse, error: aiError } = await supabaseClient.functions.invoke('ai-provider-service', {
    body: requestBody
  });

  if (aiError) {
    console.error('AI Provider Service error:', aiError);
    throw new Error(`AI Provider error: ${aiError.message}`);
  }

  const data = aiResponse;
  console.log(`Received response from ${aiProvider}`);
  const assistantMessage = data.choices[0].message;
  let assistantResponse = assistantMessage.content || '';
  
  // Check if GPT-4o wants to call the image generation function
  let contentType = 'text';
  let toolResultsData = null;
  
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCall = assistantMessage.tool_calls[0];
    
    if (toolCall.function.name === 'generate_image') {
      console.log('GPT-4o requested image generation:', toolCall.function.arguments);
      
      try {
        const imageParams = JSON.parse(toolCall.function.arguments);
        
        // Normalize parameters before calling generateImageWithDALLE
        const normalizedParams = {
          prompt: imageParams.prompt,
          size: ['1024x1024', '1536x1024', '1024x1536', 'auto'].includes(imageParams.size || '') 
            ? imageParams.size 
            : 'auto',
          quality: 'auto' // Always use auto for consistency
        };
        
        console.log(`Generating image with gpt-image-1: "${normalizedParams.prompt}" (normalized: size=${normalizedParams.size}, quality=${normalizedParams.quality})`);
        
        // Generate the image using configured AI provider
        const imageResult = await generateImageWithDALLE(normalizedParams, supabaseClient, {
          ai_provider: aiProvider,
          ai_model: aiModel
        });
        
        if (imageResult.success) {
          contentType = 'image_generation';
          toolResultsData = {
            success: true,
            tool_id: 'openai_image_generation',
            results: imageResult,
            summary: `Generated image: "${imageParams.prompt.substring(0, 50)}..."`,
            metadata: {
              execution_time: imageResult.metadata?.execution_time || 0,
              api_calls: 1,
              content_type: 'image_generation'
            }
          } as any;
          
          // Generate a conversational response about the image
          const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'You just generated an image. Provide a brief, conversational response about what you created.'
                },
                {
                  role: 'user',
                  content: `I generated an image with the prompt: "${imageParams.prompt}". Write a brief response about what you created.`
                }
              ],
              max_tokens: 150,
              temperature: 0.7,
            }),
          });
          
          if (followUpResponse.ok) {
            const followUpData = await followUpResponse.json();
            assistantResponse = followUpData.choices[0].message.content || `I've generated an image of ${imageParams.prompt} for you!`;
          } else {
            assistantResponse = `I've generated an image of ${imageParams.prompt} for you!`;
          }
        } else {
          assistantResponse = `I apologize, but I encountered an error while generating the image: ${imageResult.error}`;
        }
        
      } catch (error) {
        console.error('Error processing image generation:', error);
        assistantResponse = 'I apologize, but I encountered an error while generating the image. Please try again.';
      }
    }
  }
  
  // Handle tool results from the agent tools system
  if (toolResults && toolResults.length > 0 && !toolResultsData) {
    const firstTool = toolResults[0];
    if (firstTool.metadata?.content_type === 'image_generation') {
      contentType = 'image_generation';
      toolResultsData = firstTool;
    } else if (firstTool.metadata?.content_type === 'web_research') {
      contentType = 'web_research';
      toolResultsData = firstTool;
      
      // Generate a user-friendly summary instead of showing raw JSON
      try {
        const researchData = firstTool.results?.research || firstTool.results;
        if (researchData && researchData.summary) {
          assistantResponse = `I've completed comprehensive research on your query. Here's what I found:\n\n${researchData.summary}`;
        } else {
          assistantResponse = "I've completed comprehensive research on your query. Please see the detailed results below.";
        }
      } catch (error) {
        console.error('Error generating research summary:', error);
        assistantResponse = "I've completed comprehensive research on your query. Please see the detailed results below.";
      }
    } else if (toolResults.length > 1) {
      contentType = 'mixed';
      toolResultsData = { results: toolResults, summary: `Executed ${toolResults.length} tools` } as any;
    }
  }

  return {
    response: assistantResponse,
    analysis: {
      ...analysis,
      tool_results: toolResults,
      context_used: !!contextData
    },
    content_type: contentType,
    tool_results_data: toolResultsData
  };
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, agent_id, conversation_id, attachments = [], client_message_id } = await req.json();

    if (!message || !agent_id || !conversation_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: message, agent_id, conversation_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing chat request - Agent: ${agent_id}, User: ${user.id}, Message: "${message}", Attachments: ${attachments?.length || 0}`);

    // Save user message first with attachments and agent_id
    const { error: userMessageError } = await supabaseClient
      .from('chat_messages')
      .insert({
        conversation_id,
        channel_id: null,
        role: 'user',
        content: message,
        message_type: 'direct',
        mention_type: 'direct_conversation',
        attachments: attachments || [],
        agent_id: agent_id,
        client_message_id: client_message_id
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      throw new Error(`Failed to save user message: ${userMessageError.message}`);
    }

    console.log('User message saved successfully');

    // Process the message using the new modular system
    const result = await processUserMessage(
      message,
      agent_id,
      conversation_id,
      supabaseClient,
      user.id,
      attachments
    );

    // Ensure content_type is valid
    const validContentType = ['text', 'image_generation', 'web_research', 'document_analysis', 'mixed'].includes(result.content_type || '') 
      ? result.content_type 
      : 'text';
    
    // Save assistant response
    console.log('Saving assistant message with data:', {
      original_content_type: result.content_type,
      validated_content_type: validContentType,
      has_tool_results: !!result.tool_results_data,
      tool_results_summary: result.tool_results_data?.summary || 'none'
    });
    
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        conversation_id,
        channel_id: null,
        role: 'assistant',
        content: result.response,
        content_type: validContentType,
        tool_results: result.tool_results_data,
        message_type: 'direct',
        mention_type: 'direct_conversation',
        agent_id: agent_id
      });
    
    if (saveError) {
      console.error('Error saving assistant message:', saveError);
      throw new Error(`Failed to save assistant message: ${saveError.message}`);
    }
    
    console.log('Assistant message saved successfully');

    // Update conversation timestamp
    await supabaseClient
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    const responseData = {
      success: true,
      response: result.response,
      analysis: result.analysis,
      content_type: result.content_type,
      tool_results: result.tool_results_data
    };

    console.log('Chat response generated successfully');

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-agent:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});