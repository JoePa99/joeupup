import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntentAnalysisRequest {
  message: string;
  agentId: string;
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
  attachments?: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
  }>;
}

interface IntentAnalysisResponse {
  action_type: 'tool' | 'document_search' | 'both' | 'assistant_only' | 'long_rich_text';
  tools_required?: Array<{
    tool_id: string;
    action: string;
    parameters: Record<string, any>;
    priority: number;
  }>;
  document_search_query?: string;
  confidence: number;
  reasoning: string;
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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, agentId, conversationHistory = [], attachments = [] }: IntentAnalysisRequest = await req.json();
    
    console.log('🔍 [DEBUG] Intent analyzer received:', { message, agentId, attachments: attachments?.length || 0 });

    // Get agent's available tools with UUIDs
    const { data: agentTools, error: toolsError } = await supabaseClient
      .from('agent_tools')
      .select(`
        tool_id,
        is_enabled,
        configuration,
        tools:tool_id (
          id,
          name,
          display_name,
          description,
          tool_type,
          schema_definition
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_enabled', true);

    if (toolsError) {
      console.error('Error fetching agent tools:', toolsError);
    }

    const availableTools = agentTools?.map(at => {
      const tool = Array.isArray(at.tools) ? at.tools[0] : at.tools;
      return {
        id: tool?.id,
        name: tool?.name,
        display_name: tool?.display_name,
        description: tool?.description,
        schema: tool?.schema_definition
      };
    }) || [];

    // Create tool mapping for the prompt
    const toolMapping = agentTools?.reduce((acc, at) => {
      const tool = Array.isArray(at.tools) ? at.tools[0] : at.tools;
      if (tool?.name) {
        acc[tool.name] = tool.id;
      }
      return acc;
    }, {} as Record<string, string>) || {};

    // Get current date for dynamic date handling
    const currentDate = new Date();
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentDateStr = currentDate.toISOString().split('T')[0];
    
    // For calendar dates, we need RFC3339 format with timezone
    const todayRFC3339 = `${currentDateStr}T00:00:00Z`;
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(currentDate.getDate() + 7); // Week from today
    const weekFromTodayRFC3339 = `${tomorrowDate.toISOString().split('T')[0]}T23:59:59Z`;

    // Create conversation context string
    const conversationContext = conversationHistory.length > 0 
      ? `\nRecent conversation context:\n${conversationHistory.slice(-8).map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n`
      : '';

    // Analyze intent with OpenAI including conversation context
    const systemPrompt = `You are an intelligent intent analyzer for an AI assistant. Your job is to analyze user messages and determine what actions are needed, considering the conversation context.

Current date: ${currentDateStr}
Yesterday's date: ${yesterdayStr}
${conversationContext}
Available tools for this agent:
${availableTools.map(tool => `- ${tool.name} (ID: ${tool.id}): ${tool.description}`).join('\n')}

Tool ID mapping:
${Object.entries(toolMapping).map(([name, id]) => `${name} -> ${id}`).join('\n')}

CRITICAL: If openai_web_research is available and the user asks for research, market analysis, industry trends, current information, competitor analysis, market data, industry insights, or any request requiring current web data, you MUST use it with action "research".

RESEARCH DETECTION PATTERNS:
- Explicit research requests: "research", "analyze", "investigate", "study"
- Market/industry queries: "market analysis", "industry trends", "market data", "competitor analysis"
- Current information: "latest developments", "current state", "what's happening in", "recent news about"
- Data requests: "find information about", "look up", "search for information"
- Industry insights: "industry insights", "market research", "competitive landscape"

Analyze the user's message and respond with a JSON object following this exact schema:
{
  "action_type": "tool" | "document_search" | "both" | "assistant_only" | "long_rich_text",
  "tools_required": [
    {
      "tool_id": "TOOL_UUID_HERE",
      "action": "search|read|create",
      "parameters": { /* tool-specific parameters */ },
      "priority": 1
    }
  ],
  "document_search_query": "extracted search terms if document search needed",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis"
}

CRITICAL INSTRUCTIONS:
- For tool_id, you MUST use the actual UUID from the tool ID mapping above, NOT the tool name
- When user mentions "yesterday", use ${yesterdayStr}T00:00:00Z to ${yesterdayStr}T23:59:59Z in date parameters
- When user mentions "today", use ${todayRFC3339} to ${currentDateStr}T23:59:59Z in date parameters
- For "this week", use ${todayRFC3339} to ${weekFromTodayRFC3339} in date parameters
- ALWAYS use RFC3339 format with timezone (e.g., 2025-09-29T00:00:00Z) for timeMin and timeMax parameters
- For Gmail searches, be specific with date ranges and search terms
- Only include tools that are available for this agent
- Be specific with tool parameters based on the user's query
- CONSIDER CONVERSATION CONTEXT: If the user refers to "that event", "the meeting", "it", etc., look at the conversation history to understand what they're referencing
- Handle follow-up questions naturally by referencing previous context

Guidelines:
- Use "tool" when the user asks for specific external data (emails, documents, spreadsheets, or explicit research/analysis requests)
- Use "document_search" when they ask about company knowledge or uploaded documents
- Use "both" when both are needed
- Use "assistant_only" for general questions, current events, sports updates, news summaries, explanations, and basic information requests
- Use "long_rich_text" when the user requests detailed analysis, reports, articles, or long-form content based on uploaded documents (e.g., "analyze this document", "create a report", "write an article about", "provide detailed analysis", "take a look at this document", "what you think about this doc") or any similar request where there is an attatchemnt involved
- For follow-up questions like "update that", "reschedule it", "delete the meeting", use conversation context to identify what the user is referring to

QUESTION TYPE CLASSIFICATION:
- General questions ("what's going on", "what's happening", "what's new", "tell me about", "explain", "describe") → "assistant_only"
- Simple current events ("NFL today", "stock market today", "weather today") → "assistant_only"
- Sports updates ("NFL results", "game scores", "race results") → "assistant_only"
- Basic explanations ("how does X work", "what is X", "explain X") → "assistant_only"
- Content generation ("write a post", "create a LinkedIn post", "generate content", "write an article", "create a blog post", "draft a message") → "assistant_only" or "long_rich_text"
- News-style queries ("today's news", "latest headlines", "breaking news", "top stories") → use web research
- Only use "tool" with web research for explicit research/analysis requests

IMPORTANT WEB RESEARCH TRIGGERS:
- Use web research for news-style queries: "today's news", "latest headlines", "breaking news", "top stories", "current news"
- Use web research for specific, detailed, or analytical requests that require current data
- Research triggers: "research on [topic]", "market analysis", "industry trends", "competitive analysis", "financial analysis", "detailed report on", "comprehensive analysis of"
- Examples of research queries: "research the SaaS market trends", "analyze current AI industry growth", "market analysis of electric vehicles", "competitive analysis of tech companies", "today's news", "latest headlines"
- DO NOT use research for simple questions like "what's going on", "what's happening", "what's new", "tell me about", "explain", "describe" (unless they are news-specific)
- DO NOT use research for content generation requests like "write a post", "create a LinkedIn post", "generate content", "write an article", "create a blog post", "draft a message"
- General knowledge questions should use "assistant_only" - the assistant can handle basic questions about current events, sports, news, etc.
- Content generation requests should use "assistant_only" or "long_rich_text" - the assistant can create content using its knowledge
- Use research for news queries and when the user explicitly asks for analysis, research, or detailed investigation`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    // Parse the JSON response
    let analysis: IntentAnalysisResponse;
    try {
      analysis = JSON.parse(analysisText);
      
      // Apply confidence thresholds and fallback logic
      if (analysis.confidence < 0.7) {
        console.log('🔍 [DEBUG] Low confidence analysis, applying fallback logic');
        // For low confidence, default to assistant_only for general questions
        if (analysis.action_type === 'tool' && analysis.tools_required?.some(tool => tool.action === 'research')) {
          // Check if this looks like a general question or content generation
          const generalQuestionPatterns = [
            /what's going on/i,
            /what's happening/i,
            /what's new/i,
            /tell me about/i,
            /explain/i,
            /describe/i,
            /how does/i,
            /what is/i
          ];
          
          const contentGenerationPatterns = [
            /write a post/i,
            /create a post/i,
            /write a linkedin post/i,
            /create a linkedin post/i,
            /generate content/i,
            /write an article/i,
            /create a blog post/i,
            /draft a message/i,
            /write a message/i,
            /create content/i,
            /generate a post/i,
            /write content/i
          ];
          
          const isGeneralQuestion = generalQuestionPatterns.some(pattern => pattern.test(message));
          const isContentGeneration = contentGenerationPatterns.some(pattern => pattern.test(message));
          
          if (isGeneralQuestion) {
            console.log('🔍 [DEBUG] General question detected, overriding to assistant_only');
            analysis = {
              action_type: 'assistant_only',
              confidence: 0.8,
              reasoning: 'General question detected, using assistant knowledge instead of research'
            };
          } else if (isContentGeneration) {
            console.log('🔍 [DEBUG] Content generation detected, overriding to assistant_only');
            analysis = {
              action_type: 'assistant_only',
              confidence: 0.8,
              reasoning: 'Content generation request detected, using assistant knowledge instead of research'
            };
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to parse OpenAI response as JSON:', analysisText);
      // Fallback analysis
      analysis = {
        action_type: 'assistant_only',
        confidence: 0.5,
        reasoning: 'Failed to parse intent, defaulting to assistant-only response'
      };
    }

    // Check for attachments and document analysis keywords BEFORE research pattern detection
    // This ensures document analysis takes precedence over web research when attachments are present
    const hasAttachments = attachments && attachments.length > 0;
    const documentAnalysisKeywords = [
      /\b(analyze|review|summarize|read|examine|look at|tell me about|what do you think|what's in this|what does this say|go through|break down)\b/i,
      /\b(this\s+(document|file|paper|report|contract|letter|email|attachment|doc)|the\s+(document|file|attachment|attached))\b/i,
      /\b(document|file|attachment|attached|uploaded)\b/i
    ];
    
    const isDocumentAnalysisRequest = hasAttachments && 
      documentAnalysisKeywords.some(pattern => pattern.test(message));
    
    if (isDocumentAnalysisRequest) {
      console.log('🔍 [DEBUG] Document analysis request detected with attachments, skipping research pattern override');
      console.log('🔍 [DEBUG] Message:', message, 'Attachments:', attachments.length);
      
      // Ensure action_type is set to long_rich_text for document analysis
      if (analysis.action_type !== 'long_rich_text') {
        analysis = {
          action_type: 'long_rich_text',
          confidence: Math.max(analysis?.confidence ?? 0.9, 0.9),
          reasoning: 'Document analysis request detected with attachments - routing to document analysis workflow'
        };
      }
    }

    // Enhanced research pattern detection: Force web research for research-style queries
    // Skip this override if we already detected a document analysis request
    const researchPatterns = [
      // News patterns
      /(\bnews\b|headlines|breaking|top stories|today'?s\s+news|latest\s+(news|headlines)|current\s+news)/i,
      // Research patterns (excluding document analysis context)
      /(\bresearch\b|\banalyz[e|ing]\b|\bmarket\s+analysis\b|\btrends?\b|\bindustry\s+data\b|\bcompetitor\b|\bcurrent\s+state\b|\blatest\s+developments?\b)/i,
      // Market/industry patterns
      /(\bmarket\s+(research|data|insights|intelligence)\b|\bindustry\s+(trends|analysis|insights|landscape)\b|\bcompetitive\s+(analysis|landscape|intelligence)\b)/i,
      // Information gathering patterns
      /(\bfind\s+information\s+about\b|\blook\s+up\b|\bsearch\s+for\s+information\b|\bwhat's\s+happening\s+in\b|\brecent\s+developments\s+in\b)/i,
      // Current data patterns
      /(\bcurrent\s+(information|data|state|situation)\b|\blatest\s+(information|data|updates)\b|\bup-to-date\s+(information|data)\b)/i
    ];
    
    const hasResearchPattern = researchPatterns.some(pattern => pattern.test(message));
    
    // Only apply research pattern override if:
    // 1. No document analysis request was detected, AND
    // 2. Either no attachments OR the message is clearly about web research (not document analysis)
    const shouldApplyResearchOverride = hasResearchPattern && !isDocumentAnalysisRequest && 
      (!hasAttachments || !documentAnalysisKeywords.some(pattern => pattern.test(message)));
    
    if (shouldApplyResearchOverride) {
      const webResearchToolId = toolMapping['openai_web_research'];
      if (webResearchToolId) {
        console.log('🔍 [DEBUG] Research pattern detected for message:', message);
        console.log('🔍 [DEBUG] Using web research tool ID:', webResearchToolId);
        
        // Determine research depth based on query complexity
        let depth = 'detailed';
        if (/\b(quick|brief|summary|overview)\b/i.test(message)) {
          depth = 'quick';
        } else if (/\b(comprehensive|thorough|detailed|in-depth|extensive)\b/i.test(message)) {
          depth = 'comprehensive';
        }
        
        analysis = {
          action_type: 'tool',
          tools_required: [{
            tool_id: webResearchToolId,
            action: 'research',
            parameters: {
              query: message,
              depth: depth,
              include_sources: true
            },
            priority: 1
          }],
          confidence: Math.max(analysis?.confidence ?? 0.85, 0.85),
          reasoning: `Research pattern detected; routing to web research via Perplexity (depth: ${depth})`
        };
      } else {
        console.log('🔍 [DEBUG] Research pattern detected but web research tool not available');
        console.log('🔍 [DEBUG] Available tools:', Object.keys(toolMapping));
        analysis = {
          action_type: 'assistant_only',
          confidence: 0.8,
          reasoning: 'Web research tool disabled. Enable openai_web_research to fetch current information via Perplexity.'
        };
      }
    }

    console.log('🔍 [DEBUG] Intent Analysis Result:', JSON.stringify(analysis, null, 2));
    
    if (analysis.action_type === 'long_rich_text') {
      console.log('🔍 [DEBUG] Long rich text detected with attachments:', attachments?.length || 0);
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intent-analyzer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});