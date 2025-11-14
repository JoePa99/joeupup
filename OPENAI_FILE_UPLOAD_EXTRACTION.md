# OpenAI File Upload Extraction Guide

## Overview

The `extract-document-text` edge function now leverages OpenAI’s **Files API** and **Responses API** to perform literal document extraction. This approach supports PDFs, DOCX, PPTX, images, scanned documents, and mixed content without MIME restrictions or manual parsing.

## High-Level Flow

```
Supabase Storage → download file
             ↓
OpenAI Files API (purpose: assistants)
             ↓
OpenAI Responses API (gpt-4.1)
             ↓
Poll for completion → extract output_text
             ↓
Store text + metadata in company_os
             ↓
Delete temporary OpenAI file
```

## Key Endpoints

- **Upload**: `POST https://api.openai.com/v1/files`
  - Headers: `Authorization: Bearer <OPENAI_API_KEY>`
  - Body: `FormData` with `purpose=assistants`, `file=<File>`
- **Extraction**: `POST https://api.openai.com/v1/responses`
  ```json
  {
    "model": "gpt-4.1",
    "input": [
      {
        "role": "user",
        "content": [
          { "type": "input_text", "text": "<extraction instructions>" },
          { "type": "file_reference", "file_id": "file-xyz" }
        ]
      }
    ]
  }
  ```
- **Polling**: `GET https://api.openai.com/v1/responses/{id}` until `status === 'completed'`
- **Cleanup**: `DELETE https://api.openai.com/v1/files/{file_id}`

## Extraction Instructions (Summary)

- Copy **all** company-related content verbatim (no summaries)
- Preserve exact wording, numbers, quotes
- Read all pages/sections, including tables and charts
- Return only the document text (no meta commentary)
- If the document is empty, respond with `EMPTY_DOCUMENT`

## Metadata Captured

Each extraction stores the following in `company_os.metadata`:

- `extraction_method`: `openai_file_upload_gpt-4.1`
- `openai_file_id`: temporary file identifier (useful for auditing)
- `openai_response_id`: references the Responses API call
- `extracted_text_length`: character count of returned text
- `fileSize`, `fileType`, and timestamps for traceability

## Operational Notes

- **File size limit**: 512 MB (OpenAI enforced)
- **Typical runtime**: 30–120 seconds depending on size/complexity
- **Error handling**: function retries via polling and surfaces actionable messages
- **Cleanup**: uploaded files are deleted immediately after extraction completes

## Recommended Monitoring

- Track extraction success rate (`status = 'draft'` → `'completed'`)
- Watch for spikes in failures referencing OpenAI uploads or responses
- Log `openai_response_id` for support/debugging requests

## Troubleshooting Tips

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| “File is too large” | File > 512 MB | Ask user to compress/split document |
| “Not enough extractable information” | Empty or binary content | Verify document contents; consider manual review |
| Response stuck in `in_progress` | Large document still processing | Wait ~2 minutes; function times out with clear error |
| OpenAI upload failure | Invalid API key / network issue | Check `OPENAI_API_KEY`, retry |

## Future Enhancements

- Streaming responses (reduce polling latency)
- Chunked uploads for >512 MB files
- Optional caching of extracted text for re-runs
- User-facing preview of extracted content before generation

---

This guide provides the essentials for understanding, operating, and extending the OpenAI file upload extraction workflow.



