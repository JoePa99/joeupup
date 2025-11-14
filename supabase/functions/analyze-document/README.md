# Analyze Document Function

This Edge Function provides multi-provider document analysis capabilities, supporting OpenAI, Google Gemini, and Anthropic Claude.

## Features

- **Multi-Provider Support**: Automatically routes to the correct AI provider based on agent configuration
- **Structured Analysis**: Returns consistent JSON structure regardless of provider
- **Comprehensive Analysis**: Includes executive summary, key findings, themes, data points, and recommendations

## Request Format

```json
{
  "documentContent": "Full text content of the document",
  "documentName": "document.pdf",
  "userMessage": "Please analyze this document for key insights",
  "agentId": "agent-uuid",
  "aiProvider": "openai|google|anthropic",
  "aiModel": "gpt-4o-mini|google/gemini-2.0-flash-exp|claude-3-5-sonnet-20241022"
}
```

## Response Format

```json
{
  "success": true,
  "analysis": {
    "executiveSummary": "Brief 2-3 sentence overview",
    "keyFindings": ["Finding 1", "Finding 2", ...],
    "mainThemes": ["Theme 1", "Theme 2", ...],
    "importantDataPoints": ["Data point 1", "Data point 2", ...],
    "recommendations": ["Recommendation 1", "Recommendation 2", ...],
    "detailedAnalysis": "Comprehensive multi-paragraph analysis",
    "documentType": "Report|Contract|Policy|Manual|etc",
    "confidenceScore": 0.85
  },
  "metadata": {
    "aiProvider": "openai",
    "aiModel": "gpt-4o-mini",
    "documentName": "document.pdf",
    "analyzedAt": "2025-10-02T...",
    "contentLength": 15000
  }
}
```

## AI Provider Configuration

### OpenAI
- Uses Chat Completions API
- JSON mode for structured output
- Models: gpt-4o, gpt-4o-mini, gpt-3.5-turbo

### Google Gemini
- Uses Lovable AI Gateway
- Supports gemini-2.0-flash-exp and other Gemini models
- Automatically extracts JSON from markdown code blocks

### Anthropic Claude
- Uses Messages API
- Models: claude-3-5-sonnet, claude-3-opus, claude-3-haiku
- Automatically extracts JSON from markdown code blocks

## Environment Variables Required

- `OPENAI_API_KEY`: For OpenAI analysis
- `LOVABLE_API_KEY`: For Google Gemini analysis  
- `ANTHROPIC_API_KEY`: For Anthropic Claude analysis

## Integration

This function is called by `generate-rich-content` when a document needs to be analyzed. The workflow:

1. User uploads document and sends message
2. `chat-with-agent` detects document analysis intent
3. `parse-document` extracts text from the file
4. `generate-rich-content` calls `analyze-document` with agent's AI provider
5. `analyze-document` routes to appropriate AI service
6. Structured analysis is returned and formatted into rich content
7. User can view and edit the analysis in the rich text editor

## Error Handling

The function provides detailed error messages for:
- Missing API keys
- Invalid AI provider
- API request failures
- JSON parsing errors
- Missing required fields

All errors include stack traces for debugging.

