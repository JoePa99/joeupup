# CompanyOS Two-Step Implementation - Deployment Checklist

## Quick Summary

Successfully separated the document-based CompanyOS generation into two independent steps with direct AI processing:
1. **Text Extraction** (`extract-document-text`) - Uploads documents to OpenAI Files API and extracts content via the Responses API
2. **CompanyOS Generation** (`generate-company-os-from-text`)

**Key Change**: The extraction step now uploads documents directly to OpenAI, references the uploaded file in a Responses API request, and retrieves literal document content. This bypasses `parse-document`, eliminates MIME restrictions, and improves reliability across PDFs, DOCX, images, and scans.

## Pre-Deployment Steps

### 1. Review Changes
```bash
git status
git diff
```

**Modified Files:**
- ✅ `supabase/migrations/20251029124054_add_status_to_company_os.sql`
- ✅ `supabase/functions/extract-document-text/index.ts` (new)
- ✅ `supabase/functions/generate-company-os-from-text/index.ts` (new)
- ✅ `src/types/company-os.ts`
- ✅ `src/lib/company-os.ts`
- ✅ `src/components/company-os/CompanyOSGenerator.tsx`

### 2. Database Migration

Run the migration to add the status column:

```bash
# For production (via Supabase CLI)
supabase db push

# Or manually in Supabase Dashboard SQL Editor
# Copy contents of: supabase/migrations/20251029124054_add_status_to_company_os.sql
```

**What it does:**
- Adds `company_os_status` ENUM type
- Adds `status` column (defaults to `completed`)
- Makes `os_data` nullable
- Adds index on status column

### 3. Deploy Edge Functions

Deploy the two new edge functions:

```bash
# Deploy extract-document-text
supabase functions deploy extract-document-text

# Deploy generate-company-os-from-text
supabase functions deploy generate-company-os-from-text
```

**Required Environment Variables:**
Both functions need:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (**required for BOTH functions** - AI-powered extraction and generation)

### 4. Deploy Frontend

Build and deploy the frontend application:

```bash
# Build
npm run build

# Deploy to your hosting platform
# (Vercel, Netlify, etc.)
```

## Testing Checklist

### Smoke Tests

1. **Upload a Document**
   - [ ] Go to Playbook page
   - [ ] Click Generate/Regenerate CompanyOS
   - [ ] Switch to "From Document" tab
   - [ ] Upload a PDF or DOCX file (test with files >500KB)
   - [ ] Observe progress indicators (Upload → Extract → Generate)
   - [ ] Verify successful generation
   - [ ] **Note**: Extraction may take 30-120s for large files (AI processing time)

2. **Check Database**
   ```sql
   SELECT 
     id,
     company_id,
     status,
     version,
     LENGTH(raw_scraped_text) as text_length,
     jsonb_typeof(os_data) as data_type,
     created_at,
     updated_at
   FROM company_os
   ORDER BY created_at DESC
   LIMIT 5;
   ```
   - [ ] Status should be `completed`
   - [ ] `raw_scraped_text` should contain extracted text
   - [ ] `os_data` should be a valid JSONB object
   - [ ] Check `metadata->>'extraction_method' = 'openai_file_upload_gpt-4.1'`
   - [ ] `metadata` should include `openai_file_id` and `openai_response_id`
   - [ ] `raw_scraped_text` length should align with document size

3. **Monitor Edge Function Logs**
   ```bash
   # View logs for extract-document-text
   supabase functions logs extract-document-text --tail

   # View logs for generate-company-os-from-text
   supabase functions logs generate-company-os-from-text --tail
   ```
   - [ ] No errors in extraction step
   - [ ] No errors in generation step
   - [ ] Check execution times

### Edge Cases

4. **Small Document (< 100 chars)**
   - [ ] Should fail with clear error message
   - [ ] Status should be `failed`

5. **Large Document (> 100 MB)**
   - [ ] Should fail with "File is too large" error (OpenAI limit 512MB)
   - [ ] Ensure messaging guides user to compress/split the file

6. **Unsupported Content** (binary file, image with no text)
   - [ ] Extraction should return "not enough extractable information"
   - [ ] Status should be `failed`

## Rollback Plan

If issues occur, you can rollback:

### 1. Revert Frontend
```bash
git revert HEAD
npm run build
# Redeploy
```

### 2. Revert Edge Functions
Keep the old `generate-company-os-from-document` function active.

### 3. Database Migration Rollback
```sql
-- Remove status column
ALTER TABLE public.company_os DROP COLUMN IF EXISTS status;

-- Make os_data non-nullable again
ALTER TABLE public.company_os 
ALTER COLUMN os_data SET NOT NULL;

-- Drop the enum type
DROP TYPE IF EXISTS company_os_status;
```

## Monitoring

### Key Metrics to Watch

1. **Success Rate**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
   FROM company_os
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY status;
   ```

2. **Processing Times**
   Check edge function logs for:
   - Text extraction time
   - Generation time
   - Total time

3. **Error Rates**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
     COUNT(*) as total_count,
     COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as failure_rate
   FROM company_os
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

## Support Documentation

### User-Facing Changes

**Improved Progress Tracking:**
Users now see detailed progress during document upload:
1. ● Upload → ○ Extract → ○ Generate
2. ○ Upload → ● Extract → ○ Generate
3. ○ Upload → ○ Extract → ● Generate

**No Breaking Changes:**
- Existing CompanyOS records work without modification
- API interface remains the same from user perspective
- Old function still exists for compatibility

### Troubleshooting Guide

**Issue: Status stuck on 'extracting'**
- Check `extract-document-text` function logs for upload or OpenAI errors
- Validate the file exists in Supabase Storage and is < 512MB
- Confirm `OPENAI_API_KEY` is set

**Issue: Status stuck on 'generating'**
- Check `generate-company-os-from-text` function logs
- Verify OpenAI API key is valid
- Check OpenAI API status

**Issue: "Document does not contain enough readable text"**
- Document has < 100 characters of text
- User should upload a document with more content

## Success Criteria

- [x] Database migration executed successfully
- [x] New edge functions deployed
- [x] Frontend updated with progress tracking
- [ ] Smoke tests pass
- [ ] No errors in production logs for 24 hours
- [ ] Error rate < 5%
- [ ] User feedback is positive

## Communication

### Internal Team
- Notify team of deployment
- Share this checklist
- Set up monitoring alerts

### Users (if needed)
- No user communication needed (transparent upgrade)
- Enhanced progress tracking is a positive change
- No changes to workflow or functionality

## Post-Deployment

### Week 1
- Monitor error rates daily
- Review edge function logs
- Check performance metrics
- Gather user feedback

### Week 2-4
- Consider deprecating old `generate-company-os-from-document` function
- Add analytics for step-by-step timing
- Consider adding text preview feature

## Sign-Off

- [ ] Database migration verified
- [ ] Edge functions deployed and tested
- [ ] Frontend deployed and tested  
- [ ] Monitoring in place
- [ ] Team notified
- [ ] Ready for production traffic

**Deployed by:** _________________

**Date:** _________________

**Notes:** _________________

