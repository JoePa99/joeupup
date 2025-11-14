import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeDocumentRequest {
  documentContent: string;
  documentName: string;
  userMessage: string;
  agentId: string;
  aiProvider: 'openai' | 'google' | 'anthropic';
  aiModel: string;
}

interface DocumentAnalysis {
  executiveSummary: string;
  keyFindings: string[];
  mainThemes: string[];
  importantDataPoints: string[];
  recommendations: string[];
  detailedAnalysis: string;
  documentType: string;
  confidenceScore: number;
}

/**
 * Upload document to OpenAI and analyze it
 */
async function analyzeWithOpenAI(
  documentContent: string,
  documentName: string,
  userMessage: string,
  model: string
): Promise<DocumentAnalysis> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('📄 [OpenAI] Analyzing document:', documentName);

  const analysisPrompt = `You are an expert document analyst. Analyze the following document and provide a comprehensive, structured analysis.

Document Name: "${documentName}"
User Request: ${userMessage}

Document Content:
${documentContent}

Provide your analysis in the following JSON format:
{
  "executiveSummary": "A brief 2-3 sentence overview of the document",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "mainThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "importantDataPoints": ["Data point 1 with specific numbers/facts", "Data point 2"],
  "recommendations": ["Recommendation 1 based on the analysis", "Recommendation 2"],
  "detailedAnalysis": "A comprehensive analysis with multiple paragraphs covering all important aspects of the document. Include specific details, quotes, and insights.",
  "documentType": "Type of document (e.g., Report, Contract, Policy, Manual, etc.)",
  "confidenceScore": 0.85
}

Ensure all fields are populated with meaningful content. The detailedAnalysis should be thorough and well-structured.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyst. Always respond with valid JSON matching the requested structure.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [OpenAI] API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  console.log('✅ [OpenAI] Analysis completed');
  
  return JSON.parse(content);
}

/**
 * Upload document to Google Gemini and analyze it
 */
async function analyzeWithGemini(
  documentContent: string,
  documentName: string,
  userMessage: string,
  model: string
): Promise<DocumentAnalysis> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    throw new Error('Lovable API key (for Gemini) not configured');
  }

  console.log('📄 [Gemini] Analyzing document:', documentName);

  const analysisPrompt = `You are an expert document analyst. Analyze the following document and provide a comprehensive, structured analysis.

Document Name: "${documentName}"
User Request: ${userMessage}

Document Content:
${documentContent}

Provide your analysis in the following JSON format:
{
  "executiveSummary": "A brief 2-3 sentence overview of the document",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "mainThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "importantDataPoints": ["Data point 1 with specific numbers/facts", "Data point 2"],
  "recommendations": ["Recommendation 1 based on the analysis", "Recommendation 2"],
  "detailedAnalysis": "A comprehensive analysis with multiple paragraphs covering all important aspects of the document. Include specific details, quotes, and insights.",
  "documentType": "Type of document (e.g., Report, Contract, Policy, Manual, etc.)",
  "confidenceScore": 0.85
}

Ensure all fields are populated with meaningful content. The detailedAnalysis should be thorough and well-structured.`;

  const geminiModel = model.includes('gemini') ? model : 'google/gemini-2.0-flash-exp';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: geminiModel,
      messages: [
        {
          role: 'system',
          content: 'You are an expert document analyst. Always respond with valid JSON matching the requested structure.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [Gemini] API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Gemini might wrap JSON in markdown code blocks, so extract it
  let jsonContent = content;
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }
  
  console.log('✅ [Gemini] Analysis completed');
  
  return JSON.parse(jsonContent);
}

/**
 * Upload document to Anthropic Claude and analyze it
 */
async function analyzeWithClaude(
  documentContent: string,
  documentName: string,
  userMessage: string,
  model: string
): Promise<DocumentAnalysis> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  console.log('📄 [Claude] Analyzing document:', documentName);

  const analysisPrompt = `You are an expert document analyst. Analyze the following document and provide a comprehensive, structured analysis.

Document Name: "${documentName}"
User Request: ${userMessage}

Document Content:
${documentContent}

Provide your analysis in the following JSON format:
{
  "executiveSummary": "A brief 2-3 sentence overview of the document",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "mainThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "importantDataPoints": ["Data point 1 with specific numbers/facts", "Data point 2"],
  "recommendations": ["Recommendation 1 based on the analysis", "Recommendation 2"],
  "detailedAnalysis": "A comprehensive analysis with multiple paragraphs covering all important aspects of the document. Include specific details, quotes, and insights.",
  "documentType": "Type of document (e.g., Report, Contract, Policy, Manual, etc.)",
  "confidenceScore": 0.85
}

Ensure all fields are populated with meaningful content. The detailedAnalysis should be thorough and well-structured. Respond ONLY with the JSON object, no additional text.`;

  const claudeModel = model.includes('claude') ? model : 'claude-3-5-sonnet-20241022';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ [Claude] API error:', errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  
  // Claude might wrap JSON in markdown code blocks, so extract it
  let jsonContent = content;
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }
  
  console.log('✅ [Claude] Analysis completed');
  
  return JSON.parse(jsonContent);
}

/**
 * Main handler
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      documentContent,
      documentName,
      userMessage,
      agentId,
      aiProvider,
      aiModel
    }: AnalyzeDocumentRequest = await req.json();

    console.log('📄 [analyze-document] Starting analysis:', {
      documentName,
      aiProvider,
      aiModel,
      contentLength: documentContent?.length || 0
    });

    if (!documentContent || !documentName || !aiProvider) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: documentContent, documentName, aiProvider'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let analysis: DocumentAnalysis;

    // Route to appropriate AI provider
    switch (aiProvider) {
      case 'openai':
        analysis = await analyzeWithOpenAI(documentContent, documentName, userMessage, aiModel);
        break;
      
      case 'google':
        analysis = await analyzeWithGemini(documentContent, documentName, userMessage, aiModel);
        break;
      
      case 'anthropic':
        analysis = await analyzeWithClaude(documentContent, documentName, userMessage, aiModel);
        break;
      
      default:
        // Default to OpenAI if provider not recognized
        console.log(`⚠️ Unknown provider "${aiProvider}", defaulting to OpenAI`);
        analysis = await analyzeWithOpenAI(documentContent, documentName, userMessage, aiModel);
    }

    console.log('✅ [analyze-document] Analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis,
      metadata: {
        aiProvider,
        aiModel,
        documentName,
        analyzedAt: new Date().toISOString(),
        contentLength: documentContent.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [analyze-document] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

