# CompanyOS Two-Step Implementation Summary

## Overview

Successfully refactored the document-based CompanyOS generation from a single monolithic process into two separate, sequential operations:

1. **Text Extraction** - Extract text from uploaded documents
2. **CompanyOS Generation** - Generate structured CompanyOS from extracted text

This separation provides better progress tracking, error handling, and the ability to retry generation without re-extracting text.

## What Was Implemented

### 1. Database Schema Changes

**File**: `supabase/migrations/20251029124054_add_status_to_company_os.sql`

- Added `company_os_status` ENUM type with values: `draft`, `extracting`, `generating`, `completed`, `failed`
- Added `status` column to `company_os` table (defaults to `completed` for backward compatibility)
- Made `os_data` column nullable to support draft records during text extraction
- Added index on `status` column for efficient queries

### 2. New Edge Functions

#### Extract Document Text Function

**File**: `supabase/functions/extract-document-text/index.ts`

**Purpose**: Step 1 - Uploads the original document to OpenAI, requests a literal extraction via the Responses API, and stores the resulting text.

**Process**:
1. Authenticates the user
2. Validates input parameters (companyId, filePath, fileName, fileType)
3. Sets status to `'extracting'` (if record exists)
4. **Downloads the document from Supabase Storage**
5. **Uploads the document to OpenAI Files API** (`purpose = assistants`) and obtains a `file_id`
6. **Calls OpenAI Responses API** with `gpt-4.1`, passing:
   - Extraction instructions (copy all company-related content, literal wording)
   - A `file_reference` pointing to the uploaded `file_id`
7. Polls `GET /v1/responses/{id}` until status is `completed`
8. Extracts the returned text, cleans up the temporary OpenAI file, and stores the text in `company_os`
9. Captures metadata (file size, OpenAI file/response IDs, extracted text length)

**Key Features**:
- **Universal format support** (PDF, DOCX, PPTX, images, scans)
- **No MIME restrictions** – OpenAI handles the raw document directly
- **Automatic polling and cleanup** of OpenAI resources
- Validates minimum text length (100 characters)
- Updates status to `'failed'` on errors
- Stores rich metadata: extraction method, OpenAI IDs, file size, timestamps
- Handles files up to OpenAI’s 512MB limit
- Comprehensive logging for each stage (download, upload, response)

#### Generate CompanyOS From Text Function

**File**: `supabase/functions/generate-company-os-from-text/index.ts`

**Purpose**: Step 2 - Generate structured CompanyOS from extracted text

**Process**:
1. Authenticates the user
2. Fetches extracted text from database if not provided in request
3. Updates status to `'generating'`
4. Prepares text for OpenAI (truncates if > 400k characters)
5. Calls OpenAI API (gpt-4o model) with comprehensive prompts
6. Validates and parses JSON response
7. Updates `company_os` record with:
   - `status = 'completed'`
   - `os_data = companyOSData`
   - Increments version number
8. Returns complete CompanyOS object

**Key Features**:
- Can accept text directly or read from database
- Comprehensive error handling with status updates
- Validates required schema sections
- Handles both new and existing records

### 3. TypeScript Types

**File**: `src/types/company-os.ts`

**Added Types**:
- `CompanyOSStatus` - Union type for status values
- `ExtractDocumentTextRequest` - Request parameters for text extraction
- `ExtractDocumentTextResponse` - Response from text extraction
- `GenerateFromTextRequest` - Request parameters for generation
- `GenerateFromTextResponse` - Response from generation

**Updated Types**:
- `CompanyOS` interface now includes `status` field
- `os_data` field is now `CompanyOSData | Record<string, never>` to support empty objects

### 4. Frontend Integration

**File**: `src/lib/company-os.ts`

**New Functions**:
- `extractDocumentText()` - Wrapper for extract-document-text edge function
- `generateFromExtractedText()` - Wrapper for generate-company-os-from-text edge function

**Updated Function**:
- `generateCompanyOSFromDocument()` - Now orchestrates both steps:
  1. Calls `extractDocumentText()`
  2. Provides progress callback with step updates
  3. Calls `generateFromExtractedText()`
  4. Returns complete result with extracted text

**Progress Callback**:
```typescript
onProgress?: (step: 'extracting' | 'generating') => void
```

### 5. UI Updates

**File**: `src/components/company-os/CompanyOSGenerator.tsx`

**Enhanced UI Features**:
- Added `generationStep` state to track current phase
- Visual progress indicator showing: Upload → Extract → Generate
- Dynamic status messages for each step:
  - "Uploading Document..."
  - "Extracting Text..."
  - "Generating CompanyOS... (30-90 seconds)"
- Progress dots that highlight the current step
- Improved error handling with step-specific messages

**Visual Progress Indicator**:
```
● Upload → ○ Extract → ○ Generate  (uploading)
○ Upload → ● Extract → ○ Generate  (extracting)
○ Upload → ○ Extract → ● Generate  (generating)
```

## Architecture Benefits

### 1. Separation of Concerns
- Text extraction is independent from CompanyOS generation
- Each function has a single, well-defined responsibility
- Easier to test, debug, and maintain

### 1.5. Direct AI Processing
- **No dependency on parse-document**: Documents are uploaded straight to OpenAI
- **One unified workflow**: Responses API handles PDFs, DOCX, images, scans via file references
- **Built-in OCR**: OpenAI extracts text from scanned pages automatically
- **No MIME headaches**: Avoids “Vision-only image MIME” limitations
- **Better quality**: AI processes the original document context, including tables and layout

### 2. Progress Tracking
- Status column enables real-time progress monitoring
- UI can show users exactly what's happening
- Better user experience with visual feedback

### 3. Error Recovery
- Can retry generation without re-extracting text (saves time and API calls)
- Failed extractions don't waste OpenAI credits
- Easier to diagnose issues (is it extraction or generation?)

### 4. Performance Optimization
- Text extraction happens once and is cached
- Can inspect extracted text before generation
- Future: Could enable users to edit extracted text before generation

### 5. Debugging & Analytics
- Status column enables tracking of process bottlenecks
- Metadata captures timing for each phase
- Easier to identify which step is causing issues

## Database State Flow

```
Initial State → extracting → draft → generating → completed
                     ↓          ↓          ↓
                   failed    failed    failed
```

### State Definitions

- **draft**: Text has been extracted, ready for generation
- **extracting**: Text extraction in progress
- **generating**: AI generation in progress
- **completed**: Process finished successfully, CompanyOS ready
- **failed**: Process encountered an error

## Testing Guide

### Manual Testing Steps

1. **Access Playbook Page**
   - Navigate to the Playbook section
   - Click "Generate CompanyOS" or "Regenerate"

2. **Upload Document**
   - Switch to "From Document" tab
   - Upload a PDF, DOCX, or other supported document
   - Add optional additional context

3. **Monitor Progress**
   - Observe the progress indicator:
     - ● Upload → ○ Extract → ○ Generate (uploading to storage)
     - ○ Upload → ● Extract → ○ Generate (OpenAI processing the uploaded file)
     - ○ Upload → ○ Extract → ● Generate (AI generating CompanyOS)
   - Watch status messages update (expect 30–120s for large files)

4. **Verify Result**
   - Check that CompanyOS is generated successfully
   - Verify all sections are populated
   - Check for "(Assumed)" and "(Direct Quote)" annotations
   - **Verify extraction quality:** Raw text should be a literal transcript of the document

5. **Database Verification**
   ```sql
   SELECT 
     id, 
     company_id, 
     status, 
     version,
     LENGTH(raw_scraped_text) as text_length,
     os_data IS NOT NULL as has_data,
     metadata->>'source_type' as source_type,
     metadata->>'extraction_method' as extraction_method,
     metadata->>'raw_text_length' as raw_length,
     metadata->>'extracted_text_length' as extracted_length,
     metadata->>'openai_file_id' as openai_file_id,
     metadata->>'openai_response_id' as openai_response_id
   FROM company_os
   WHERE company_id = 'your-company-id';
   ```
   - Check `extraction_method` should be `'openai_file_upload_gpt-4.1'`
   - `openai_file_id` / `openai_response_id` should be present for traceability
   - `extracted_text_length` should align with document content length

### Edge Cases to Test

1. **Small Document** (< 100 chars)
   - Should fail with appropriate error message
   - Status should be set to 'failed'

2. **Large Document** (> 100 MB)
   - Should fail fast with "File is too large" error (OpenAI limit 512MB)
   - Surface actionable guidance (compress or split document)

3. **Unsupported/Binary File**
   - Upload may succeed but extraction should identify lack of readable content
   - Expect clear error: "Document does not contain enough extractable information"

4. **Network Interruption**
   - Each step is independent
   - Failed step should not affect completed steps

5. **Retry After Failure**
   - Extract once, retry generation multiple times
   - Should use cached extracted text

## API Documentation

### Extract Document Text

**Endpoint**: `supabase.functions.invoke('extract-document-text')`

**Request**:
```typescript
{
  companyId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  bucket?: string; // defaults to 'documents'
}
```

**Response**:
```typescript
{
  success: boolean;
  extractedText?: string;
  textLength?: number;
  recordId?: string;
  metadata?: {
    fileName: string;
    extractionTime: number; // milliseconds
    extractionMethod?: string;
    openAIFileId?: string;
    openAIResponseId?: string;
  };
  error?: string;
}
```

### Generate From Text

**Endpoint**: `supabase.functions.invoke('generate-company-os-from-text')`

**Request**:
```typescript
{
  companyId: string;
  extractedText?: string; // optional, reads from DB if not provided
  additionalContext?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  companyOS?: CompanyOS;
  metadata?: {
    sourceType: string;
    generated_at: string;
    execution_time: number; // milliseconds
    model: string; // 'openai/gpt-4o'
  };
  error?: string;
}
```

## Migration Path

### For Existing Users

1. **Database Migration**
   - Run the migration: `20251029124054_add_status_to_company_os.sql`
   - Existing records will have `status = 'completed'`
   - Existing records work without changes

2. **Code Deployment**
   - Deploy new edge functions
   - Update frontend code
   - No breaking changes to existing API

3. **Old Function**
   - The old `generate-company-os-from-document` function still exists
   - Can be deprecated or removed in a future release
   - No current code calls it directly

## Future Enhancements

### Potential Improvements

1. **Text Preview**
   - Show extracted text to users before generation
   - Allow users to edit or refine extracted text

2. **Partial Regeneration**
   - Regenerate specific sections without full reprocessing
   - Use cached text for faster iterations

3. **Multi-Document Support**
   - Combine text from multiple documents
   - Merge insights from various sources

4. **Background Processing**
   - Queue extraction and generation as background jobs
   - Notify users when complete

5. **Progress Webhooks**
   - Real-time updates via websockets
   - Better for very large documents

6. **Analytics Dashboard**
   - Track extraction vs generation times
   - Identify performance bottlenecks
   - Monitor failure rates by step

## Troubleshooting

### Common Issues

**Issue**: "Document does not contain enough readable text"
- **Cause**: Extracted text < 100 characters
- **Solution**: Ensure document has sufficient text content, not just images

**Issue**: "Failed to parse document"
- **Cause**: Unsupported file format or corrupted file
- **Solution**: Check file format, try re-uploading

**Issue**: Status stuck on 'extracting' or 'generating'
- **Cause**: Edge function timeout or crash
- **Solution**: Check edge function logs, retry the operation

**Issue**: "Failed to parse CompanyOS response"
- **Cause**: OpenAI returned invalid JSON
- **Solution**: Check OpenAI API status, retry generation

## Files Modified

1. ✅ `supabase/migrations/20251029124054_add_status_to_company_os.sql`
2. ✅ `supabase/functions/extract-document-text/index.ts`
3. ✅ `supabase/functions/generate-company-os-from-text/index.ts`
4. ✅ `src/types/company-os.ts`
5. ✅ `src/lib/company-os.ts`
6. ✅ `src/components/company-os/CompanyOSGenerator.tsx`

## Deployment Checklist

- [ ] Run database migration
- [ ] Deploy edge functions:
  - [ ] `extract-document-text`
  - [ ] `generate-company-os-from-text`
- [ ] Deploy frontend changes
- [ ] Test end-to-end flow
- [ ] Monitor edge function logs
- [ ] Verify status updates in database

## Success Metrics

- ✅ Text extraction and generation are separate operations
- ✅ Progress is tracked and visible to users
- ✅ Status column enables monitoring
- ✅ Error handling is improved
- ✅ UI provides clear feedback
- ✅ Code is maintainable and testable

## Conclusion

The two-step process for CompanyOS generation is now complete and provides:
- Better user experience with progress tracking
- Improved error handling and recovery
- Cleaner architecture with separation of concerns
- Foundation for future enhancements

All components are ready for deployment and testing in production.

