# Extract Document Text - Debugging Guide

## Overview

This guide helps you debug issues with the AI-powered document extraction process by interpreting the logs from the `extract-document-text` edge function.

## How to View Logs

```bash
# View real-time logs
supabase functions logs extract-document-text --tail

# View recent logs
supabase functions logs extract-document-text
```

Or in Supabase Dashboard:
1. Go to Edge Functions
2. Select `extract-document-text`
3. Click "Logs" tab

## Log Breakdown

### 1. Initial Information
```
📄 [EXTRACT-TEXT] Extracting text from document: filename.pdf
📄 [EXTRACT-TEXT] File type: application/pdf
📄 [EXTRACT-TEXT] Company ID: xxx-xxx-xxx
```
**What to check**: Verify the correct file is being processed.

---

### 2. Raw Text Parsing
```
📄 [EXTRACT-TEXT] Parsing document to get raw text...
📄 [EXTRACT-TEXT] Raw text parsed, length: 125000
📄 [EXTRACT-TEXT] Raw text sample (first 500 chars): [sample text]
📄 [EXTRACT-TEXT] Raw text sample (last 500 chars): [sample text]
```

**What to check**:
- ✅ **Length > 0**: Document was parsed successfully
- ✅ **Samples show actual content**: Not just headers/gibberish
- ❌ **Length < 100**: Document is too short or failed to parse
- ❌ **Samples are nonsense**: PDF might be scanned/image-based

**Common Issues**:
- **Scanned PDFs**: Will show gibberish or very short text → Need OCR
- **Protected PDFs**: May fail to parse → Need password removal
- **Corrupted files**: Will show errors or empty content

---

### 3. Text Preparation
```
📄 [EXTRACT-TEXT] Text for extraction length: 125000
📄 [EXTRACT-TEXT] ⚠️ Text was truncated from 500000 to 400000 characters
```

**What to check**:
- ⚠️ **Truncation warning**: If document > 400k chars, some content is lost
- **Solution**: Split large documents or increase `maxInputLength`

---

### 4. OpenAI Request
```
📄 [EXTRACT-TEXT] Sending request to OpenAI...
📄 [EXTRACT-TEXT] Model: gpt-4.1, Temperature: 0.1
📄 [EXTRACT-TEXT] Prompt length: 125500 characters
```

**What to check**:
- ✅ **Model name**: Verify correct model (gpt-4.1, gpt-4o, etc.)
- ✅ **Temperature**: Should be low (0.1-0.3) for consistent extraction
- ✅ **Prompt length**: Should be close to raw text length + instructions (~500 chars)

---

### 5. OpenAI Response
```
📄 [EXTRACT-TEXT] OpenAI response structure: {
  id: 'chatcmpl-xxx',
  model: 'gpt-4.1',
  choices_count: 1,
  usage: { prompt_tokens: 30000, completion_tokens: 5000, total_tokens: 35000 },
  finish_reason: 'stop'
}
```

**What to check**:
- ✅ **choices_count: 1**: Got a response
- ✅ **finish_reason: 'stop'**: Response completed normally
- ⚠️ **finish_reason: 'length'**: Response was cut off (hit token limit)
- ⚠️ **finish_reason: 'content_filter'**: Content was flagged by OpenAI
- ❌ **No choices**: OpenAI error

**Common Issues**:

**finish_reason: 'length'**
- AI response hit max token limit
- Extracted text is incomplete
- **Solution**: Reduce input size or use model with larger context

**finish_reason: 'content_filter'**
- Content triggered OpenAI safety filters
- **Solution**: Check document for sensitive content

---

### 6. Extracted Text
```
📄 [EXTRACT-TEXT] OpenAI extraction completed, length: 98000
📄 [EXTRACT-TEXT] Extracted text sample (first 1000 chars): [sample text]
📄 [EXTRACT-TEXT] Extracted text sample (last 500 chars): [sample text]
```

**What to check**:
- ✅ **Samples show clean company content**: Headers/footers removed
- ✅ **No repetitive page numbers**: AI cleaned successfully
- ❌ **Samples are empty or generic**: AI failed to extract properly
- ❌ **Samples don't match original**: AI hallucinated content

**Red Flags**:
```
Extracted text sample: "I cannot extract content from this document..."
```
→ AI refused or failed to extract. Check raw text quality.

```
Extracted text sample: "Here is the extracted content: [then actual content]"
```
→ AI added meta-commentary. Prompt needs adjustment.

---

### 7. Extraction Summary
```
📄 [EXTRACT-TEXT] Extraction summary:
  - Raw text: 125000 chars
  - Extracted text: 98000 chars
  - Reduction: 21.6%
  - OpenAI tokens used: 35000
```

**What to check**:
- ✅ **Reduction 10-40%**: Normal (removed headers, footers, formatting)
- ⚠️ **Reduction > 80%**: AI removed too much content
- ⚠️ **Reduction < 5%**: AI didn't clean much (may still have artifacts)
- ❌ **Extracted < 100 chars**: Extraction failed

**Healthy Ranges**:
- **Well-formatted document**: 10-25% reduction
- **Document with lots of headers/footers**: 30-50% reduction
- **Scanned/poorly formatted**: May not reduce much (AI keeps everything)

---

### 8. Warning Messages

#### Length Truncation Warning
```
📄 [EXTRACT-TEXT] ⚠️ OpenAI finish_reason is not "stop": length
📄 [EXTRACT-TEXT] This may indicate the response was truncated or incomplete
```
**Issue**: AI hit max output tokens
**Solution**: 
- Use model with larger context window
- Reduce input size
- Split document into chunks

#### Excessive Reduction Warning
```
📄 [EXTRACT-TEXT] ⚠️ Extracted text is 85% smaller than raw text
📄 [EXTRACT-TEXT] AI may have removed too much content. Check extraction quality.
```
**Issue**: Too much content removed
**Possible causes**:
- AI interpreted instructions too strictly
- Document has unusual formatting
- Content doesn't look like "company information"

**Solution**:
- Review prompt instructions
- Check extracted text samples to see what's missing
- Adjust extraction rules

#### Short Output Warning
```
📄 [EXTRACT-TEXT] ⚠️ Extracted text is very short compared to raw text
📄 [EXTRACT-TEXT] Raw: 50000 chars → Extracted: 300 chars
```
**Issue**: Major content loss
**Solution**:
- Check OpenAI response for errors
- Review raw text samples - may not contain company info
- AI might be refusing to extract for some reason

---

## Common Problems & Solutions

### Problem: "AI is not returning actual content"

**Step 1: Check Raw Text**
```
📄 [EXTRACT-TEXT] Raw text sample (first 500 chars): [what do you see?]
```
- If gibberish → PDF parsing issue (scanned doc, encryption)
- If empty → File upload issue
- If looks good → Continue to Step 2

**Step 2: Check OpenAI Response**
```
📄 [EXTRACT-TEXT] OpenAI response structure: { finish_reason: ? }
```
- If 'length' → Response truncated, reduce input
- If 'content_filter' → Content flagged, check document
- If 'stop' → Continue to Step 3

**Step 3: Check Extracted Text Sample**
```
📄 [EXTRACT-TEXT] Extracted text sample (first 1000 chars): [what do you see?]
```
- If meta-commentary ("I extracted..." / "Here is...") → Prompt issue
- If summary instead of extraction → AI misunderstood task
- If generic/vague → AI couldn't find relevant content
- If empty → Major extraction failure

**Step 4: Check Reduction**
```
📄 [EXTRACT-TEXT] Reduction: X%
```
- If > 80% → AI removed too much
- Check warning messages for clues

### Problem: AI returning summaries instead of full text

**Symptoms**:
```
Extracted: "This document describes a company that provides software services..."
```
Instead of actual document content.

**Cause**: AI interpreting "extract" as "summarize"

**Solution**: Update prompt to emphasize:
```typescript
"CRITICAL: Extract the COMPLETE text content, not a summary. 
Copy the exact words from the document, preserving all details."
```

### Problem: AI adding meta-commentary

**Symptoms**:
```
Extracted: "Based on the document, I extracted the following content: [content]"
```

**Cause**: AI being conversational

**Solution**: Strengthen the system message:
```typescript
"Return ONLY the extracted text. NO explanations, NO meta-commentary, 
NO introductions. Just the text itself."
```

### Problem: Extraction stops mid-content

**Symptoms**:
```
finish_reason: 'length'
Extracted text ends abruptly
```

**Cause**: Hit output token limit

**Solutions**:
1. Use model with larger context (gpt-4o-turbo)
2. Reduce input text size
3. Use max_tokens parameter
4. Process in chunks

### Problem: Empty or very short extraction

**Check these in order**:

1. **Raw text length**
   - If < 100: Document parsing failed
   - If > 5000: Continue checking

2. **OpenAI response**
   - Check `finish_reason`
   - Check `usage.completion_tokens` > 0

3. **Extracted text samples**
   - Look for any content at all
   - Check for error messages from AI

4. **Prompt and model**
   - Verify model name is correct
   - Check temperature is set

## Debugging Checklist

When extraction fails, check logs in this order:

- [ ] Raw text successfully parsed (length > 100)
- [ ] Raw text samples show actual content
- [ ] Text sent to OpenAI (not truncated too much)
- [ ] OpenAI response received (choices_count: 1)
- [ ] finish_reason is 'stop'
- [ ] Extracted text length > 100
- [ ] Extracted text samples look correct
- [ ] Reduction percentage is reasonable (10-50%)
- [ ] No warning messages

## Quick Fixes

### Enable more detailed logging
Already done! Current version has comprehensive logs.

### Test with simple document
Upload a plain text file with clear company info to isolate the issue.

### Bypass AI extraction temporarily
In `extract-document-text/index.ts`:
```typescript
// Skip AI extraction for testing
const extractedText = rawText; // Use raw text directly
```

### Increase max length
```typescript
const maxInputLength = 800000; // Increase from 400k
```

### Try different model
```typescript
model: 'gpt-4o' // Instead of gpt-4.1
```

## Need More Help?

If issues persist after checking all the above:

1. **Share the full logs** for a specific extraction attempt
2. **Sample document**: What type of document? (PDF, DOCX, etc.)
3. **Expected vs Actual**: What should be extracted vs what was extracted
4. **Error messages**: Any specific errors in logs

## Monitoring Queries

### Check extraction success rate
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'draft') as stuck_in_draft
FROM company_os
WHERE metadata->>'extraction_method' = 'openai_gpt-4.1'
AND created_at > NOW() - INTERVAL '24 hours';
```

### Check extraction quality
```sql
SELECT 
  metadata->>'raw_text_length' as raw_length,
  metadata->>'extracted_text_length' as extracted_length,
  (
    100 - (
      metadata->>'extracted_text_length'::float / 
      NULLIF(metadata->>'raw_text_length'::float, 0) * 100
    )
  )::int as reduction_percent,
  created_at
FROM company_os
WHERE metadata->>'extraction_method' = 'openai_gpt-4.1'
ORDER BY created_at DESC
LIMIT 10;
```

---

**Remember**: The logs now show everything you need to diagnose extraction issues. Start from the top and work your way down through each stage! 🔍




