# CompanyOS Document Upload Feature - Implementation Summary

## Overview
Successfully implemented the document upload feature for CompanyOS generation. Users can now generate their CompanyOS by either:
1. **Web Research** - Using Perplexity AI to research the company (existing feature)
2. **Document Upload** - Uploading company documents for AI analysis (new feature)

## What Was Implemented

### 1. Regeneration Capability
**File:** `src/pages/Playbook.tsx`

Added the ability to regenerate an existing CompanyOS:
- **"Regenerate" button** appears alongside "Edit" when CompanyOS exists
- Users can choose between Web Research or Document Upload for regeneration
- Clear warning message that regeneration will replace current version
- "Back to View" button to cancel and return to viewing the current CompanyOS
- Automatic version increment when regenerating (handled by edge functions)

### 2. New Edge Function
**File:** `supabase/functions/generate-company-os-from-document/index.ts`

A new Supabase Edge Function that:
- Accepts uploaded documents (PDF, DOCX, TXT, MD, CSV, PPTX)
- Leverages existing `parse-document` function to extract text from documents
- Uses OpenAI GPT-4o to analyze document content and generate CompanyOS
- Stores result in `company_os` table with document metadata
- Returns structured CompanyOS JSON matching the same schema as web research

**Key Features:**
- Document text extraction using existing parse-document infrastructure
- Same CompanyOS schema as web research for consistency
- Marks assumptions with "(Assumed)" for data traceability
- Stores document reference in metadata for audit trail
- Support for additional context to guide AI analysis

### 2. Updated Types
**File:** `src/types/company-os.ts`

Added new interfaces:
- `GenerateCompanyOSFromDocumentRequest` - Request parameters for document-based generation
- Extended `GenerateCompanyOSResponse` metadata to include:
  - `fileName` - Name of uploaded document
  - `sourceType` - Either 'web_research' or 'document_upload'

### 3. Library Function
**File:** `src/lib/company-os.ts`

Added new function:
```typescript
generateCompanyOSFromDocument(request: GenerateCompanyOSFromDocumentRequest)
```

This function:
- Invokes the new edge function
- Handles error cases gracefully
- Returns same interface as web research generation for consistency

### 4. Updated UI Component
**File:** `src/components/company-os/CompanyOSGenerator.tsx`

Major UI enhancements:
- **Tabbed Interface**: Switch between "Web Research" and "Document Upload" modes
- **Document Upload Tab** includes:
  - File picker with drag-and-drop support
  - File type validation (PDF, DOCX, TXT, MD, CSV, PPTX)
  - File size validation (10MB max)
  - Selected file preview with size display
  - Additional context textarea
  - Clear progress indicators during upload and processing
- **Web Research Tab**: Unchanged from original implementation
- Unified look and feel across both modes

### 5. Enhanced Existing Function
**File:** `supabase/functions/generate-company-os/index.ts`

Updated to include `source_type: 'web_research'` in metadata for consistency and differentiation from document uploads.

## Technical Details

### Document Processing Flow

1. **User uploads document** via UI file picker
2. **File validation** - Check type and size
3. **Upload to Storage** - Store in `documents` bucket under `{companyId}/company-os/` path
4. **Edge function invoked** with file path and metadata
5. **Text extraction** - Call `parse-document` to extract text from uploaded file
6. **AI analysis** - Send extracted text to OpenAI GPT-4o with CompanyOS schema
7. **JSON parsing & validation** - Ensure response matches required schema
8. **Database storage** - Save to `company_os` table with document metadata
9. **UI update** - Display generated CompanyOS to user

### Supported File Types

| Format | Extension | Processing Method |
|--------|-----------|-------------------|
| PDF | .pdf | OpenAI Assistants API via parse-document |
| Word | .docx, .doc | OpenAI Assistants API via parse-document |
| Text | .txt, .md | Direct text extraction |
| CSV | .csv | Direct text extraction |
| PowerPoint | .pptx | OpenAI Assistants API via parse-document |

### Metadata Storage

Both generation methods now store metadata in the `company_os.metadata` JSONB field:

**Web Research:**
```json
{
  "source_type": "web_research",
  "industry": "...",
  "specificContext": "...",
  "generated_at": "..."
}
```

**Document Upload:**
```json
{
  "source_type": "document_upload",
  "source_document": {
    "fileName": "company-overview.pdf",
    "filePath": "{companyId}/company-os/{timestamp}-{filename}",
    "fileType": "application/pdf",
    "uploadedAt": "..."
  },
  "additionalContext": "...",
  "generated_at": "..."
}
```

## AI Prompt Differences

### Web Research (Perplexity)
- Emphasis on web search and real-time data
- Instructions to research from official sources
- Uses Perplexity sonar-pro model

### Document Upload (OpenAI)
- Emphasis on analyzing provided document content
- Instructions to extract information from document text
- Uses OpenAI GPT-4o model with JSON response format
- Same schema structure for consistency

## User Experience

### First Time Generation
Users without a CompanyOS see the generator directly with both modes available.

### Web Research Mode
1. Enter company name (required)
2. Optionally add industry, website URL, and context
3. Click "Generate CompanyOS"
4. AI researches company using web search
5. View generated CompanyOS (30-60 seconds)

### Document Upload Mode
1. Click "Choose Document" to select file
2. File is validated and displayed with size
3. Optionally add additional context
4. Click "Generate CompanyOS from Document"
5. Document uploads and AI analyzes content
6. View generated CompanyOS (30-90 seconds depending on file size)

### Regenerating Existing CompanyOS
1. View existing CompanyOS with "Regenerate" and "Edit" buttons
2. Click "Regenerate" button
3. See warning: "Regenerating CompanyOS will replace the current version"
4. Choose between Web Research or Document Upload tabs
5. Fill in required information for chosen method
6. Click generate button to replace existing CompanyOS
7. Version automatically increments in database
8. Can click "Back to View" to cancel and return to viewing current version

## Benefits

### For Users
- **Flexibility**: Choose between web research or document upload based on needs
- **Control**: Upload existing company documents for more accurate results
- **Privacy**: Keep proprietary information within uploaded documents
- **Efficiency**: Skip web research when comprehensive documents already exist

### For Companies
- **Accuracy**: Use official company documents for precise CompanyOS
- **Consistency**: Maintain brand voice from existing materials
- **Speed**: Faster setup when documents are readily available
- **Audit Trail**: Document reference stored for compliance and updates

## Testing Recommendations

Before deployment, test the following scenarios:

1. **Document Upload - PDF**
   - Upload a company PDF (e.g., brand guidelines, overview)
   - Verify text extraction and CompanyOS generation
   
2. **Document Upload - DOCX**
   - Upload a Word document
   - Verify proper processing
   
3. **Document Upload - TXT**
   - Upload a plain text file
   - Verify generation works

4. **File Validation**
   - Try uploading invalid file types (should be rejected)
   - Try uploading files > 10MB (should be rejected)
   
5. **Error Handling**
   - Upload corrupted files (should show error message)
   - Upload files with minimal text (should handle gracefully)
   
6. **Web Research Mode**
   - Verify existing web research still works
   - Confirm metadata includes source_type
   
7. **Switch Between Modes**
   - Switch tabs during generation (should preserve state)
   - Generate with web research, then regenerate with document

8. **Regeneration Flow**
   - Create initial CompanyOS via web research
   - Verify "Regenerate" button appears alongside "Edit"
   - Click "Regenerate" and verify warning message displays
   - Test "Back to View" button returns to viewer
   - Regenerate with document upload (should increment version)
   - Verify version number increases in database
   - Check metadata reflects new source_type
   - Regenerate again with web research (verify switching sources works)
   
9. **UI State Management**
   - Switch between viewing, editing, and regenerating modes
   - Verify all buttons work correctly in each state
   - Test canceling operations returns to correct state

## Deployment Steps

1. **Deploy Edge Function**
   ```bash
   npx supabase functions deploy generate-company-os-from-document
   ```

2. **Verify Environment Variables**
   Ensure `OPENAI_API_KEY` is set in Supabase (already required for parse-document)

3. **Test in Staging**
   Upload various document types and verify generation

4. **Deploy Frontend**
   Deploy updated React components

5. **Monitor Logs**
   Check edge function logs for any issues:
   - Look for "🏢 [COMPANY-OS-DOC]" log entries
   - Monitor OpenAI API usage
   - Check document parsing success rate

## Known Limitations

1. **File Size**: 10MB maximum (Supabase storage limit)
2. **Processing Time**: Large documents may take 60-90 seconds
3. **Text Extraction**: Image-based PDFs may have limited text extraction
4. **Token Limits**: Very large documents are truncated to 80,000 characters (~20k tokens)

## Future Enhancements

Potential improvements:
1. **OCR Support**: Add OCR for image-based PDFs
2. **Multiple Documents**: Allow uploading multiple documents at once
3. **Document Preview**: Show extracted text before generation
4. **Regeneration**: Reuse uploaded document for easy updates
5. **Document Library**: Store and manage uploaded documents
6. **Batch Processing**: Process multiple companies from single document

## Files Created/Modified

### Created
- `supabase/functions/generate-company-os-from-document/index.ts` (380 lines)
- `COMPANYOS_DOCUMENT_UPLOAD_IMPLEMENTATION.md` (this file)

### Modified
- `src/components/company-os/CompanyOSGenerator.tsx` (from 200 to 462 lines)
- `src/pages/Playbook.tsx` (added regeneration capability)
- `src/lib/company-os.ts` (added 29 lines)
- `src/types/company-os.ts` (added 10 lines)
- `supabase/functions/generate-company-os/index.ts` (minor metadata updates)

## Implementation Date
October 27, 2025

## Status
✅ **Complete and Ready for Testing**

All core functionality has been implemented according to the plan. The feature is ready for deployment and user testing.

