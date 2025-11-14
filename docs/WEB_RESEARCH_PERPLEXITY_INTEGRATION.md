# Web Research with Perplexity Integration

This document describes the implementation of Perplexity-powered web research capabilities in the knowledge engine application.

## Overview

The system now automatically routes research queries to Perplexity AI via the `openai-web-research` edge function, providing real-time web information with source citations.

## Architecture

```
User Query → Intent Analyzer → Agent Tools Executor → OpenAI Web Research → Perplexity API
                ↓
         Chat Processing ← Tool Results ← Structured Research Data
```

## Key Components

### 1. Intent Analyzer (`supabase/functions/intent-analyzer/index.ts`)

Enhanced with comprehensive research pattern detection:

- **News patterns**: "news", "headlines", "breaking", "top stories"
- **Research patterns**: "research", "analyze", "market analysis", "trends"
- **Market/industry patterns**: "market research", "industry trends", "competitive analysis"
- **Information gathering**: "find information about", "look up", "search for information"
- **Current data patterns**: "current information", "latest developments"

### 2. Agent Tools Executor (`supabase/functions/agent-tools-executor/index.ts`)

Enhanced with detailed logging for web research tool execution:

- Logs Perplexity API call details
- Tracks execution time and source count
- Includes agent configuration in logs
- Provides comprehensive error handling

### 3. Chat Processing Functions

Both conversation and channel chat functions now handle web research results:

- **`supabase/functions/chat-with-agent/index.ts`**
- **`supabase/functions/chat-with-agent-channel/index.ts`**

Features:
- Special handling for `web_research` content type
- Rich formatting of research results with sources
- Structured display of sections, insights, and citations

### 4. Web Research Edge Function (`supabase/functions/openai-web-research/index.ts`)

Always uses Perplexity API with Perplexity-specific models:

- **Model**: `sonar-pro` (always used - Perplexity's most capable model)
- **API Endpoint**: `https://api.perplexity.ai/chat/completions`
- **Features**: Real-time web search, source citations, structured JSON response
- **Note**: Agent's AI model is ignored - Perplexity uses its own models exclusively

## Database Configuration

### Tools Table

The `openai_web_research` tool is automatically added to all agents with this schema:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The research query or topic to investigate"
    },
    "focus_areas": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Specific areas or aspects to focus the research on"
    },
    "depth": {
      "type": "string",
      "enum": ["quick", "detailed", "comprehensive"],
      "default": "detailed",
      "description": "The depth of research to perform"
    },
    "include_sources": {
      "type": "boolean",
      "default": true,
      "description": "Whether to include source citations in the results"
    }
  },
  "required": ["query"]
}
```

### Migration

The migration `20250128000001_fix_web_research_tools.sql` ensures:

- Tool exists in `tools` table
- All existing agents have the tool enabled
- New agents automatically get the tool via trigger
- Performance indexes are created
- Monitoring view is available

## Environment Variables

Required environment variables:

```bash
# Perplexity Configuration
PERPLEXITY_API_KEY=your_perplexity_api_key

# OpenAI Configuration (for intent analysis)
OPENAI_API_KEY=your_openai_api_key
```

## Usage Examples

### Automatic Detection

The system automatically detects research queries and routes them to Perplexity:

- "research latest AI trends"
- "analyze competitor landscape"
- "what are current market trends in technology"
- "find information about recent developments in AI"

### Manual Testing

You can test the integration using the provided scripts:

```bash
# Check configuration
node scripts/diagnose-web-research.js

# Run comprehensive tests
node scripts/test-web-research.js
```

## Response Format

Web research results include:

```json
{
  "success": true,
  "research": {
    "query": "research latest AI trends",
    "summary": "Brief overview with source citations [1]",
    "sections": [
      {
        "title": "Current AI Trends",
        "content": "Detailed analysis with citations [1], [2]",
        "key_points": ["Key insight 1 [1]", "Key insight 2 [2]"]
      }
    ],
    "key_insights": ["**Bold insight** with citation [1]"],
    "confidence_score": 0.85,
    "total_sources": 5,
    "sources": [
      {
        "title": "Actual source title",
        "url": "https://example.com/article",
        "snippet": "relevant excerpt"
      }
    ]
  },
  "metadata": {
    "depth": "detailed",
    "generated_at": "2025-01-28T...",
    "execution_time": 2500,
    "model": "perplexity/sonar-pro"
  }
}
```

## Logging

Comprehensive logging is implemented throughout the system:

- **Intent Analyzer**: Logs research pattern detection
- **Tools Executor**: Logs Perplexity API calls and parameters
- **Web Research Function**: Logs API responses and execution details
- **Chat Processing**: Logs research result formatting

Look for these log prefixes:
- `🔍 [DEBUG]` - General debugging
- `🔍 [WEB RESEARCH]` - Web research specific
- `🔍 [PERPLEXITY]` - Perplexity API specific

## Troubleshooting

### Common Issues

1. **Tool not available**: Run the diagnostic script to check configuration
2. **Perplexity API errors**: Verify API key and check logs for specific errors
3. **Intent not detected**: Check research patterns in intent analyzer
4. **No sources returned**: Verify Perplexity API quota and model availability
5. **Invalid model errors**: The system always uses `sonar-pro` - agent AI models are ignored

### Diagnostic Steps

1. Run diagnostic script: `node scripts/diagnose-web-research.js`
2. Check environment variables
3. Verify database migration was applied
4. Test with simple research query
5. Check Supabase function logs

### Perplexity Model Information

The system always uses Perplexity's `sonar-pro` model for web research. Valid Perplexity models are:
- `sonar-pro` (most capable, used by default)
- `sonar-online`
- `sonar-medium-online`
- `sonar-small-online`

Agent AI models (like `gpt-4o`, `gpt-5-2025-08-07`, etc.) are not sent to Perplexity and are ignored for web research.

### Monitoring

Use the database view to monitor tool availability:

```sql
SELECT * FROM agent_web_research_status;
```

## Performance Considerations

- **Caching**: Research results are not cached - each query hits Perplexity API
- **Rate Limits**: Perplexity API has rate limits - monitor usage
- **Cost**: Each research query consumes Perplexity API credits
- **Timeout**: Web research has longer execution time than regular queries

## Future Enhancements

Potential improvements:

1. **Result Caching**: Cache research results for similar queries
2. **Research Depth**: Allow users to specify research depth
3. **Source Filtering**: Filter sources by domain or date
4. **Research Templates**: Pre-defined research templates for common queries
5. **Batch Research**: Research multiple topics in parallel

## Security Considerations

- **API Keys**: Perplexity API key is server-side only
- **User Data**: Research queries are logged but not stored long-term
- **Rate Limiting**: Implement rate limiting for research requests
- **Content Filtering**: Perplexity handles content filtering

## Support

For issues with web research functionality:

1. Check the troubleshooting section above
2. Review Supabase function logs
3. Verify Perplexity API status
4. Run diagnostic scripts
5. Check environment variable configuration
