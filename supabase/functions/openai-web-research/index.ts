import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebResearchRequest {
  query: string;
  focus_areas?: string[];
  depth?: 'quick' | 'detailed' | 'comprehensive';
  include_sources?: boolean;
  // Note: ai_provider and ai_model removed since Perplexity uses its own models
}

interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
  accessed_at: string;
}

interface ResearchSection {
  title: string;
  content: string;
  key_points: string[];
  sources: ResearchSource[];
}

interface WebResearchResponse {
  success: boolean;
  research: {
    query: string;
    summary: string;
    sections: ResearchSection[];
    key_insights: string[];
    confidence_score: number;
    total_sources: number;
    sources: any[];
  };
  metadata: {
    depth: string;
    focus_areas: string[];
    generated_at: string;
    execution_time: number;
    model: string;
  };
  error?: string;
}

// OpenAI will provide real sources directly using its knowledge

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
    }

    // Get user from request
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
      query,
      focus_areas = [],
      depth = 'detailed',
      include_sources = true
      // Note: ai_provider and ai_model are not used since Perplexity has its own models
    }: WebResearchRequest = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Query is required and must be a non-empty string'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Always use Perplexity for web research with Perplexity-specific models
    // Valid Perplexity models: sonar-pro, sonar-online, sonar-medium-online, sonar-small-online
    const perplexityModel = 'sonar-pro'; // Always use Perplexity's sonar-pro model
    
    console.log('🔍 [PERPLEXITY] Starting web research with Perplexity API');
    console.log(`🔍 [PERPLEXITY] Query: "${query}"`);
    console.log(`🔍 [PERPLEXITY] Depth: ${depth}`);
    console.log(`🔍 [PERPLEXITY] Model: perplexity/${perplexityModel}`);
    console.log(`🔍 [PERPLEXITY] Focus areas: ${focus_areas.join(', ') || 'None'}`);
    console.log(`🔍 [PERPLEXITY] Include sources: ${include_sources}`);

    const focusAreasText = focus_areas.length > 0
      ? `\n\nPlease focus specifically on these areas: ${focus_areas.join(', ')}`
      : '';

    const depthInstructions = {
      quick: 'Provide a concise overview with key points from your web search.',
      detailed: 'Provide comprehensive analysis with detailed explanations using current web sources.',
      comprehensive: 'Provide exhaustive research with in-depth analysis from multiple current web sources.'
    };

    // Call Perplexity with web search capabilities
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: perplexityModel,
        messages: [
          {
            role: 'user',
            content: `You are an expert research analyst. Conduct web research on the following query and provide a comprehensive analysis.

Research Query: ${query}${focusAreasText}

Research Depth: ${depthInstructions[depth]}

CRITICAL REQUIREMENTS:
1. Use your web search capabilities to find CURRENT, REAL information
2. Include numeric citations throughout content using [1], [2], ... referencing actual sources you found
3. Format content using rich markdown (use **bold**, *italic*, bullet points, headers)
4. Provide concrete figures, dates, and statistics from your web search with citations
5. Return ONLY a raw JSON object (no code fences, no markdown wrapping, no "Output:" prefix)

Structure your response as this JSON format:
{
  "summary": "Brief overview with source citations [1], formatted with **bold** key terms",
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed markdown-formatted content with **bold** emphasis, *italic* text, and numeric citations [1], [2]. Use bullet points:\\n\\n• Point 1 with citation [1]\\n• Point 2 with citation [2]",
      "key_points": ["Key point 1 [1]", "Key point 2 [2]"]
    }
  ],
  "key_insights": ["**Bold insight** with citation [1]", "Important finding [2]"],
  "confidence_score": 0.85,
  "sources": [
    { "title": "Actual source title from web", "url": "https://actual-url.com/article", "snippet": "relevant excerpt" }
  ]
}

FORMATTING GUIDELINES:
- Use **bold** for key terms, statistics, and important concepts
- Use *italic* for definitions, quotes, or subtle emphasis
- Use bullet points (•) for lists
- Include [1], [2] citations after claims referencing sources
- Separate paragraphs with blank lines
- Make content scannable and well-structured

Provide real, current information from your web search with accurate source URLs.`
          }
        ]
      }),
    });

    if (!perplexityResponse.ok) {
      const errorData = await perplexityResponse.json().catch(() => ({}));
      console.error('🔍 [PERPLEXITY] API error:', errorData);
      console.error(`🔍 [PERPLEXITY] Status: ${perplexityResponse.status}`);
      console.error(`🔍 [PERPLEXITY] Error message: ${errorData.error?.message || 'Unknown error'}`);
      throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const perplexityData = await perplexityResponse.json();
    console.log('🔍 [PERPLEXITY] Received response from Perplexity API');
    console.log(`🔍 [PERPLEXITY] Response status: ${perplexityResponse.status}`);
    console.log(`🔍 [PERPLEXITY] Response length: ${JSON.stringify(perplexityData).length} characters`);
    
    let researchContent = perplexityData.choices[0].message.content as string;
    // Sanitize: strip code fences like ```json ... ``` if present
    if (typeof researchContent === 'string') {
      const fenceMatch = researchContent.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
      if (fenceMatch && fenceMatch[1]) {
        researchContent = fenceMatch[1].trim();
      }
      // Also trim any leading/trailing whitespace
      researchContent = researchContent.trim();
    }

    let parsedResearch;
    try {
      parsedResearch = JSON.parse(researchContent);
    } catch (parseError) {
      console.error('Failed to parse Perplexity response as JSON:', parseError);
      // Fallback to structured text response
      parsedResearch = {
        summary: researchContent.substring(0, 200) + '...',
        sections: [{
          title: 'Research Results',
          content: researchContent,
          key_points: ['Research completed successfully']
        }],
        key_insights: ['Detailed analysis provided'],
        confidence_score: 0.75
      };
    }

    // Build global sources list from Perplexity response
    const globalSources: ResearchSource[] = (parsedResearch.sources && Array.isArray(parsedResearch.sources))
      ? parsedResearch.sources.map((s: any, i: number) => ({
          title: s.title || `Source ${i+1}`,
          url: s.url || '',
          snippet: s.snippet || '',
          relevance_score: typeof s.relevance_score === 'number' ? s.relevance_score : 0.8,
          accessed_at: new Date().toISOString()
        }))
      : [];

    // Optionally attach per-section sources for display convenience
    if (include_sources && parsedResearch.sections) {
      parsedResearch.sections = parsedResearch.sections.map((section: ResearchSection) => ({
        ...section,
        sources: section.sources && section.sources.length > 0 ? section.sources : globalSources.slice(0, 3)
      }));
    }

    const response: WebResearchResponse = {
      success: true,
      research: {
        query,
        summary: parsedResearch.summary,
        sections: parsedResearch.sections || [],
        key_insights: parsedResearch.key_insights || [],
        confidence_score: parsedResearch.confidence_score || 0.8,
        total_sources: globalSources.length,
        sources: globalSources
      },
      metadata: {
        depth,
        focus_areas,
        generated_at: new Date().toISOString(),
        execution_time: Date.now() - startTime,
        model: `perplexity/${perplexityModel}`
      }
    };

    console.log('🔍 [PERPLEXITY] Web research completed successfully');
    console.log(`🔍 [PERPLEXITY] Query: ${query.substring(0, 50)}...`);
    console.log(`🔍 [PERPLEXITY] Sections generated: ${response.research.sections.length}`);
    console.log(`🔍 [PERPLEXITY] Total sources: ${response.research.total_sources}`);
    console.log(`🔍 [PERPLEXITY] Confidence score: ${response.research.confidence_score}`);
    console.log(`🔍 [PERPLEXITY] Execution time: ${response.metadata.execution_time}ms`);
    console.log(`🔍 [PERPLEXITY] Model used: ${response.metadata.model}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in openai-web-research:', error);
    
    const response: WebResearchResponse = {
      success: false,
      research: {
        query: '',
        summary: '',
        sections: [],
        key_insights: [],
        confidence_score: 0,
        total_sources: 0,
        sources: []
      },
      metadata: {
        depth: 'detailed',
        focus_areas: [],
        generated_at: new Date().toISOString(),
        execution_time: Date.now(),
        model: `perplexity/sonar-pro`
      },
      error: error instanceof Error ? error.message : String(error)
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
