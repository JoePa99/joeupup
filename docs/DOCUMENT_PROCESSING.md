# Document Processing and Embeddings

This document describes the new document processing functionality that automatically extracts content from uploaded documents and generates OpenAI embeddings for AI agent access.

## Overview

The system now automatically processes documents during onboarding to:
1. Upload files to Supabase Storage (existing functionality)
2. Extract text content from various file types
3. Generate OpenAI embeddings using the `text-embedding-ada-002` model
4. Store content and embeddings in a new `Documents` table
5. Make documents accessible to AI agents for knowledge retrieval

## Architecture

### Database Schema

#### New `Documents` Table
```sql
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id),
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding vector
    agent_id UUID REFERENCES public.agents(id), -- NULL = accessible by all agents
    document_archive_id UUID REFERENCES public.document_archives(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### Key Features
- **Content Storage**: Full text content extracted from documents
- **Vector Embeddings**: 1536-dimensional vectors from OpenAI
- **Agent Access Control**: `agent_id` is NULL by default (accessible by all agents)
- **Performance Indexes**: Optimized for vector similarity searches

### File Processing Pipeline

1. **Upload**: File uploaded to Supabase Storage
2. **Metadata Storage**: Document info saved to `document_archives` table
3. **Content Extraction**: Text content extracted based on file type
4. **Embedding Generation**: OpenAI API call to generate embeddings
5. **Storage**: Content and embeddings saved to `Documents` table
6. **Tagging**: Original document marked as processed

## Supported File Types

### Currently Supported
- **Text Files** (`.txt`, `.csv`): Direct text extraction
- **PDF Files** (`.pdf`): Basic text extraction (enhanced extraction planned)
- **Word Documents** (`.doc`, `.docx`): Basic text extraction (enhanced extraction planned)

### Planned Enhancements
- Enhanced PDF parsing with better text extraction
- Word document parsing with formatting preservation
- Excel file support
- Image-based document OCR

## API Endpoints

### Supabase Edge Function: `process-documents-embeddings`

**Endpoint**: `/api/supabase/functions/process-documents-embeddings`

**Method**: `POST`

**Request Body**:
```json
{
  "document_archive_id": "uuid",
  "company_id": "uuid", 
  "user_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Document processed successfully",
  "data": {
    "document_id": "uuid",
    "content_length": 1234,
    "embedding_dimensions": 1536,
    "filename": "document.pdf"
  }
}
```

## Usage

### Frontend Integration

The `DocumentUpload` component automatically processes documents after upload:

```typescript
import { processDocumentForEmbeddings } from '@/lib/document-processing';

// Process a single document
const result = await processDocumentForEmbeddings(
  documentArchiveId, 
  companyId, 
  userId
);

// Process multiple documents with progress tracking
const results = await processMultipleDocumentsForEmbeddings(
  documents,
  companyId,
  userId,
  (completed, total) => console.log(`Processed ${completed}/${total}`)
);
```

### Utility Functions

#### `processDocumentForEmbeddings(documentArchiveId, companyId, userId)`
Processes a single document and returns the result.

#### `processMultipleDocumentsForEmbeddings(documents, companyId, userId, onProgress?)`
Processes multiple documents with optional progress callback.

#### `checkDocumentProcessingStatus(documentArchiveId)`
Checks if a document has been processed for embeddings.

#### `getDocumentProcessingStats(companyId)`
Gets processing statistics for a company.

## Error Handling

The system includes comprehensive error handling:

- **File Type Validation**: Checks supported formats before processing
- **Content Extraction Errors**: Graceful fallbacks for unsupported content
- **OpenAI API Errors**: Detailed error messages and retry logic
- **Database Errors**: Transaction rollback and error logging
- **Network Errors**: Timeout handling and retry mechanisms

## Security

### Row Level Security (RLS)
- Users can only access documents from their company
- Proper authentication required for all operations
- Company isolation enforced at database level

### API Security
- Supabase service role used for backend operations
- User authentication validated for each request
- Rate limiting and request validation

## Performance Considerations

### Embedding Generation
- Text truncation for very long documents (8K token limit)
- Batch processing for multiple documents
- Async processing to avoid blocking UI

### Database Optimization
- Vector indexes for similarity searches
- Proper foreign key relationships
- Efficient query patterns

## Monitoring and Logging

### Processing Status
- Real-time status updates in UI
- Progress tracking for batch operations
- Error reporting and user feedback

### Analytics
- Processing success/failure rates
- Document type statistics
- Embedding generation metrics

## Testing

Use the `DocumentProcessingTest` component to verify functionality:

```typescript
import { DocumentProcessingTest } from '@/components/test/DocumentProcessingTest';

// Add to your test page
<DocumentProcessingTest />
```

## Future Enhancements

### Planned Features
1. **Enhanced Content Extraction**
   - Better PDF parsing with layout preservation
   - Word document formatting support
   - Image OCR capabilities

2. **Advanced Embedding Models**
   - Support for newer OpenAI models
   - Custom embedding fine-tuning
   - Multi-modal embeddings

3. **Intelligent Processing**
   - Content chunking for long documents
   - Automatic categorization
   - Duplicate detection

4. **Performance Improvements**
   - Background job processing
   - Caching and optimization
   - Distributed processing

## Troubleshooting

### Common Issues

1. **"Document not found" Error**
   - Verify document exists in `document_archives` table
   - Check company ID matches
   - Ensure user has access permissions

2. **"Failed to extract content" Error**
   - Check file type is supported
   - Verify file is not corrupted
   - Check file size limits

3. **"OpenAI API error" Error**
   - Verify API key is configured
   - Check API rate limits
   - Verify text length within limits

4. **"Failed to store embedding" Error**
   - Check database connection
   - Verify table schema
   - Check RLS policies

### Debug Mode

Enable detailed logging by setting environment variables:
```bash
SUPABASE_LOG_LEVEL=debug
OPENAI_LOG_LEVEL=debug
```

## Support

For technical support or questions about document processing:
1. Check the logs in Supabase Edge Function logs
2. Verify database schema and permissions
3. Test with the `DocumentProcessingTest` component
4. Review this documentation for common solutions




