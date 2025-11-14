# Vector Search Fix - Testing Guide

## Changes Made

### 1. **Fixed Embedding Model Mismatch** ✅
- **Problem**: Documents indexed with `text-embedding-3-large` (1536 dims), queries used `text-embedding-3-small`
- **Solution**: Standardized both to use `text-embedding-3-large` with 1536 dimensions
- **Files Updated**: 
  - `supabase/functions/chat-with-agent/index.ts`
  - `supabase/functions/chat-with-agent-channel/index.ts`

### 2. **Improved Similarity Thresholds** ✅
- **Problem**: Thresholds too high (0.1 direct, 0.5 channel) causing missed matches
- **Solution**: Standardized to 0.25 for both handlers
- **Added**: Debug logging to show max similarity when no hits found

### 3. **Added Fallback File Search** ✅
- **Problem**: When Supabase vector search fails, no alternative search method
- **Solution**: Added OpenAI Assistant file_search fallback when agent has vector_store_id
- **Benefit**: Double coverage - both pgvector and OpenAI file_search

### 4. **Centralized Embedding Configuration** ✅
- **Problem**: Risk of model drift between indexing and querying
- **Solution**: Created shared config in `supabase/functions/_shared/embedding-config.ts`
- **Files Updated**: All embedding generation now uses shared config

### 5. **Added Document Verification** ✅
- **Problem**: No verification that documents were actually indexed
- **Solution**: Added post-upload verification in `src/lib/document-processing.ts`
- **Benefit**: Early detection of indexing failures

## Testing Steps

### Test 1: Upload SOP Document
1. Upload a document containing the "Client Intake & Qualification" section
2. Verify it processes successfully and shows verification logs
3. Check that document rows are created in the `documents` table

### Test 2: Query the SOP
1. Ask: "What are the steps for our company SOP at the Client Intake?"
2. **Expected Result**: Should find relevant documents with similarity > 0.25
3. **Debug Info**: Check logs for similarity scores and document matches

### Test 3: Test Fallback (if needed)
1. If vector search still fails, verify fallback file_search activates
2. Check that agent has `vector_store_id` configured
3. Verify fallback results are added to context

### Test 4: Verify Model Consistency
1. Check that both indexing and querying use same embedding model
2. Verify 1536 dimensions in all embeddings
3. Confirm no model drift warnings in logs

## Key Log Messages to Look For

### Success Indicators:
- `"Generated embedding for document search"`
- `"Found X relevant documents"`
- `"Retrieved relevant documents from Supabase vector search"`
- `"Verified: X document chunks created for archive"`

### Debug Info:
- `"Debug: Max similarity found: X.XXX (threshold: 0.25)"`
- `"Fallback file search found relevant documents"`

### Error Indicators:
- `"No relevant documents found in vector search"`
- `"CRITICAL: No document rows found after processing"`
- `"Agent has no vector store configured for fallback search"`

## Expected Behavior

**Before Fix**: "No relevant documents found in vector search" due to model mismatch
**After Fix**: Should find documents with similarity scores, or use fallback file_search

The fix addresses the core issue where embeddings from different models couldn't be meaningfully compared, leading to zero similarity matches.
