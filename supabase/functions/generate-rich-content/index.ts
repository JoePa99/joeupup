import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRichContentRequest {
  messageId: string;
  userMessage: string;
  agentId: string;
  documentContent?: string;
  documentName?: string;
  conversationId?: string;
  channelId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { 
      messageId, 
      userMessage, 
      agentId, 
      documentContent = "",
      documentName = "",
      conversationId,
      channelId
    }: GenerateRichContentRequest = await req.json();

    console.log('🔍 [DEBUG] Starting rich content generation for message:', messageId);
    console.log('🔍 [DEBUG] Function received params:', { messageId, userMessage, agentId, documentContent: documentContent ? 'Yes' : 'No', documentName });

    // Update message to show it's generating
    await supabaseClient
      .from('chat_messages')
      .update({
        is_generating: true,
        generation_progress: 0,
        content_title: 'Generating Analysis...',
        content_metadata: { status: 'starting', documentName }
      })
      .eq('id', messageId);

    // Step 1: Get agent configuration to determine AI provider
    await updateProgress(supabaseClient, messageId, 10, 'Preparing document analysis...');
    
    const { data: agentData, error: agentError } = await supabaseClient
      .from('agents')
      .select('configuration')
      .eq('id', agentId)
      .single();

    if (agentError) {
      console.error('🔍 [ERROR] Failed to fetch agent configuration:', agentError);
      throw new Error('Failed to fetch agent configuration');
    }

    const aiProvider = agentData?.configuration?.ai_provider || 'openai';
    const aiModel = agentData?.configuration?.ai_model || 'gpt-4o-mini';

    console.log('🔍 [DEBUG] Using AI provider:', aiProvider, 'model:', aiModel);

    // Step 2: Analyze document using the analyze-document function (25%)
    await updateProgress(supabaseClient, messageId, 25, 'Analyzing document content...');
    
    const { data: analysisData, error: analysisError } = await supabaseClient.functions.invoke('analyze-document', {
      body: {
        documentContent,
        documentName,
        userMessage,
        agentId,
        aiProvider,
        aiModel
      }
    });

    if (analysisError || !analysisData?.success) {
      console.error('🔍 [ERROR] Document analysis failed:', analysisError || analysisData);
      throw new Error(analysisData?.error || 'Document analysis failed');
    }

    const analysis = analysisData.analysis;
    console.log('🔍 [DEBUG] Analysis completed:', {
      executiveSummary: analysis.executiveSummary?.substring(0, 100),
      keyFindingsCount: analysis.keyFindings?.length || 0,
      mainThemesCount: analysis.mainThemes?.length || 0
    });

    // Step 3: Format analysis into rich content (50%)
    await updateProgress(supabaseClient, messageId, 50, 'Formatting analysis...');
    
    // Build formatted content from structured analysis
    let generatedContent = `# Analysis of ${documentName}\n\n`;
    
    // Executive Summary
    generatedContent += `## Executive Summary\n\n${analysis.executiveSummary}\n\n`;
    
    // Document Type
    if (analysis.documentType) {
      generatedContent += `**Document Type:** ${analysis.documentType}\n\n`;
    }
    
    // Key Findings
    if (analysis.keyFindings && analysis.keyFindings.length > 0) {
      generatedContent += `## Key Findings\n\n`;
      analysis.keyFindings.forEach((finding: string) => {
        generatedContent += `- ${finding}\n`;
      });
      generatedContent += `\n`;
    }
    
    // Main Themes
    if (analysis.mainThemes && analysis.mainThemes.length > 0) {
      generatedContent += `## Main Themes\n\n`;
      analysis.mainThemes.forEach((theme: string) => {
        generatedContent += `- ${theme}\n`;
      });
      generatedContent += `\n`;
    }
    
    // Important Data Points
    if (analysis.importantDataPoints && analysis.importantDataPoints.length > 0) {
      generatedContent += `## Important Data Points\n\n`;
      analysis.importantDataPoints.forEach((dataPoint: string) => {
        generatedContent += `- ${dataPoint}\n`;
      });
      generatedContent += `\n`;
    }
    
    // Detailed Analysis
    if (analysis.detailedAnalysis) {
      generatedContent += `## Detailed Analysis\n\n${analysis.detailedAnalysis}\n\n`;
    }
    
    // Recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      generatedContent += `## Recommendations\n\n`;
      analysis.recommendations.forEach((recommendation: string, index: number) => {
        generatedContent += `${index + 1}. ${recommendation}\n`;
      });
      generatedContent += `\n`;
    }

    console.log('🔍 [DEBUG] Generated Content Details:', {
      contentLength: generatedContent?.length || 0,
      contentPreview: generatedContent?.substring(0, 300) + '...',
      isEmpty: !generatedContent || generatedContent.trim().length === 0
    });

    // Step 3: Formatting & Review (75%)
    await updateProgress(supabaseClient, messageId, 75, 'Formatting and reviewing content...');

    // Extract title from content or generate one
    const titleMatch = generatedContent.match(/^#+\s*(.+)/m);
    const extractedTitle = titleMatch 
      ? titleMatch[1].trim() 
      : `Analysis of ${documentName}`;

    console.log('🔍 [DEBUG] Title Extraction:', {
      titleMatch: titleMatch ? titleMatch[1] : 'No match found',
      extractedTitle,
      fallbackUsed: !titleMatch
    });

    // Create content outline from headings
    const headingRegex = /^#+\s*(.+)/gm;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(generatedContent)) !== null) {
      headings.push(match[1].trim());
    }

    console.log('🔍 [DEBUG] Heading Extraction:', {
      headingsFound: headings.length,
      headings: headings
    });

    // Step 4: Finalization (100%)
    await updateProgress(supabaseClient, messageId, 100, 'Finalizing response...');

    // Prepare rich content object with structured analysis
    const richContentObject = {
      title: extractedTitle,
      content: generatedContent,
      outline: headings,
      documentSource: documentName,
      generatedAt: new Date().toISOString(),
      wordCount: generatedContent.split(' ').length,
      // Include structured analysis for programmatic access
      structuredAnalysis: {
        executiveSummary: analysis.executiveSummary,
        keyFindings: analysis.keyFindings,
        mainThemes: analysis.mainThemes,
        importantDataPoints: analysis.importantDataPoints,
        recommendations: analysis.recommendations,
        detailedAnalysis: analysis.detailedAnalysis,
        documentType: analysis.documentType,
        confidenceScore: analysis.confidenceScore
      },
      aiProvider: aiProvider,
      aiModel: aiModel
    };

    console.log('🔍 [DEBUG] Rich Content Object to Save:', {
      title: richContentObject.title,
      contentLength: richContentObject.content?.length || 0,
      outlineLength: richContentObject.outline.length,
      documentSource: richContentObject.documentSource,
      wordCount: richContentObject.wordCount,
      hasContent: !!richContentObject.content && richContentObject.content.trim().length > 0
    });

    // Update message with final rich content
    console.log('🔍 [DEBUG] Updating database with rich content for message:', messageId);
    const { error: updateError } = await supabaseClient
      .from('chat_messages')
      .update({
        is_generating: false,
        generation_progress: 100,
        content_title: extractedTitle,
        rich_content: richContentObject,
        content_outline: headings,
        content_metadata: {
          status: 'completed',
          documentName,
          generatedAt: new Date().toISOString(),
          wordCount: generatedContent.split(' ').length,
          aiProvider: aiProvider,
          aiModel: aiModel,
          confidenceScore: analysis.confidenceScore
        },
        content_type: 'document_analysis'
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('🔍 [ERROR] Database update failed:', updateError);
      throw updateError;
    }

    console.log('🔍 [DEBUG] Database update successful for message:', messageId);

    console.log('Rich content generation completed for message:', messageId);

    return new Response(JSON.stringify({ 
      success: true,
      messageId,
      title: extractedTitle,
      contentLength: generatedContent.length,
      wordCount: generatedContent.split(' ').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    } : {
      message: String(error),
      stack: undefined,
      name: 'UnknownError',
      cause: undefined
    };

    console.error('🔍 [ERROR] Error in generate-rich-content function:', errorDetails);
    
    // Try to update message with error state if we have messageId
    const body = await req.json().catch(() => ({}));
    console.log('🔍 [DEBUG] Error handling - messageId available:', !!body.messageId);
    
    if (body.messageId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      
      console.log('🔍 [DEBUG] Updating message with error state for messageId:', body.messageId);
      await supabaseClient
        .from('chat_messages')
        .update({
          is_generating: false,
          generation_progress: 0,
          content_metadata: { 
            status: 'error', 
            error: errorDetails.message,
            errorDetails: {
              name: errorDetails.name,
              stack: errorDetails.stack,
              timestamp: new Date().toISOString()
            }
          }
        })
        .eq('id', body.messageId);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorName = error instanceof Error ? error.name : 'Error';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false,
      errorDetails: {
        name: errorName,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateProgress(
  supabaseClient: any, 
  messageId: string, 
  progress: number, 
  status: string
) {
  await supabaseClient
    .from('chat_messages')
    .update({
      generation_progress: progress,
      content_metadata: { status, progress }
    })
    .eq('id', messageId);
}