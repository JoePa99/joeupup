# Document Analysis Workflow

This document describes the multi-provider document analysis workflow implemented in the Knowledge Engine.

## Overview

When a user asks an agent to analyze a document, the system:
1. Uploads the document to the appropriate AI service (OpenAI, Google Gemini, or Anthropic Claude)
2. Extracts all text content from the document
3. Analyzes the document using the agent's configured AI provider
4. Returns a structured JSON analysis
5. Formats the analysis into rich content
6. Displays the analysis in the UI with editing capabilities

## Workflow Steps

### 1. User Sends Message with Document

User uploads a document and sends a message like:
- "Analyze this document"
- "What are the key findings in this report?"
- "Summarize this contract"

```typescript
// In unified-chat-area.tsx
const handleSendMessage = async (message: string, files: File[]) => {
  // Upload files to chat-files bucket
  // Send message with attachment metadata
};
```

### 2. Intent Detection

The `chat-with-agent` function detects the document analysis intent:

```typescript
// In chat-with-agent/index.ts
const analysis = await supabaseClient.functions.invoke('intent-analyzer', {
  body: { message, agentId, conversationHistory, attachments }
});

if (analysis.action_type === 'long_rich_text' && attachments.length > 0) {
  // Trigger document analysis workflow
}
```

### 3. Document Parsing

The `parse-document` function extracts text from various file formats:

```typescript
const { data: parseResult } = await supabaseClient.functions.invoke('parse-document', {
  body: {
    filePath: attachment.path,
    fileName: attachment.name,
    fileType: attachment.type,
    bucket: 'chat-files'
  }
});

const documentContent = parseResult.extractedText;
```

**Supported formats:**
- PDF (via OpenAI Assistants API)
- TXT, MD (plain text)
- DOCX, DOC (Microsoft Word via OpenAI)
- CSV (comma-separated values)

### 4. AI Provider Selection

The system reads the agent's configuration to determine which AI provider to use:

```typescript
// In generate-rich-content/index.ts
const { data: agentData } = await supabaseClient
  .from('agents')
  .select('configuration')
  .eq('id', agentId)
  .single();

const aiProvider = agentData?.configuration?.ai_provider || 'openai';
const aiModel = agentData?.configuration?.ai_model || 'gpt-4o-mini';
```

**Supported providers:**
- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- **Google**: gemini-2.0-flash-exp, gemini-1.5-pro
- **Anthropic**: claude-3-5-sonnet, claude-3-opus, claude-3-haiku

### 5. Document Analysis

The `analyze-document` function routes to the appropriate AI provider:

```typescript
const { data: analysisData } = await supabaseClient.functions.invoke('analyze-document', {
  body: {
    documentContent,
    documentName,
    userMessage,
    agentId,
    aiProvider,
    aiModel
  }
});
```

**Analysis Structure:**
```json
{
  "executiveSummary": "Brief 2-3 sentence overview of the document",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "mainThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "importantDataPoints": ["Specific data point 1", "Data point 2"],
  "recommendations": ["Action item 1", "Action item 2"],
  "detailedAnalysis": "Comprehensive multi-paragraph analysis...",
  "documentType": "Report|Contract|Policy|Manual|...",
  "confidenceScore": 0.85
}
```

### 6. Content Formatting

The structured analysis is formatted into markdown for display:

```typescript
// In generate-rich-content/index.ts
let generatedContent = `# Analysis of ${documentName}\n\n`;
generatedContent += `## Executive Summary\n\n${analysis.executiveSummary}\n\n`;
// ... format key findings, themes, data points, recommendations
```

### 7. Database Storage

The analysis is stored in the `chat_messages` table:

```typescript
await supabaseClient
  .from('chat_messages')
  .update({
    is_generating: false,
    content_title: extractedTitle,
    rich_content: {
      title: extractedTitle,
      content: generatedContent,  // Formatted markdown
      outline: headings,
      documentSource: documentName,
      structuredAnalysis: analysis,  // Original structured data
      aiProvider: aiProvider,
      aiModel: aiModel,
      generatedAt: new Date().toISOString(),
      wordCount: generatedContent.split(' ').length
    },
    content_metadata: {
      status: 'completed',
      documentName,
      aiProvider,
      aiModel,
      confidenceScore: analysis.confidenceScore
    },
    content_type: 'document_analysis'
  })
  .eq('id', messageId);
```

### 8. UI Display

The frontend displays the analysis with options to view and edit:

```typescript
// In unified-chat-area.tsx
if (message.content_type === 'document_analysis' && message.rich_content) {
  return (
    <Button onClick={() => {
      setRichTextContent({
        title: message.content_title,
        content: message.rich_content.content,
        messageId: message.id
      });
      setShowRichTextSidebar(true);
    }}>
      View Analysis
    </Button>
  );
}
```

### 9. Rich Text Editor

Users can edit the analysis in the rich text editor sidebar:

```typescript
// In rich-text-editor-sidebar.tsx
<RichTextEditor
  content={editedContent}
  onChange={setEditedContent}
  placeholder="Edit analysis..."
/>

// Save edited content
const handleSave = async () => {
  await supabase
    .from('chat_messages')
    .update({
      rich_content: {
        ...originalRichContent,
        content: editedContent,
        title: editedTitle
      }
    })
    .eq('id', messageId);
};
```

## Provider-Specific Implementation

### OpenAI Implementation

```typescript
async function analyzeWithOpenAI(documentContent, documentName, userMessage, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert document analyst...' },
        { role: 'user', content: analysisPrompt }
      ],
      response_format: { type: 'json_object' }  // Ensures JSON output
    }),
  });
  
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

### Google Gemini Implementation

```typescript
async function analyzeWithGemini(documentContent, documentName, userMessage, model) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp',
      messages: [
        { role: 'system', content: 'You are an expert document analyst...' },
        { role: 'user', content: analysisPrompt }
      ],
    }),
  });
  
  const data = await response.json();
  let content = data.choices[0].message.content;
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    content = jsonMatch[1];
  }
  
  return JSON.parse(content);
}
```

### Anthropic Claude Implementation

```typescript
async function analyzeWithClaude(documentContent, documentName, userMessage, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: analysisPrompt }
      ],
    }),
  });
  
  const data = await response.json();
  let content = data.content[0].text;
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    content = jsonMatch[1];
  }
  
  return JSON.parse(content);
}
```

## Error Handling

The system handles various error scenarios:

1. **Document upload failures**: User notified to retry
2. **Parsing errors**: Descriptive error message with format suggestions
3. **AI provider errors**: Falls back to OpenAI if configured provider fails
4. **API key missing**: Clear error message indicating missing configuration
5. **JSON parsing errors**: Attempts to extract JSON from markdown code blocks

## Performance Considerations

- **Async Processing**: Document analysis runs in the background
- **Progress Updates**: Real-time progress indicators (10%, 25%, 50%, 75%, 100%)
- **Content Limits**: Document content truncated to 100k characters (~25k tokens)
- **Caching**: Parsed documents can be cached in storage for faster re-analysis

## Future Enhancements

1. **Batch Analysis**: Analyze multiple documents at once
2. **Comparative Analysis**: Compare two or more documents
3. **Custom Analysis Templates**: User-defined analysis frameworks
4. **Export Options**: PDF, Word, HTML export formats
5. **Collaboration**: Share and comment on analysis
6. **Version History**: Track analysis changes over time
7. **Multi-language Support**: Analyze documents in various languages
8. **Image/Chart Analysis**: Extract insights from visual elements

