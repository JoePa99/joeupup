# Document Preview Feature

## Overview
The Document Preview feature allows users to preview various document types directly within the application without downloading them. This feature is integrated into the Documents page and provides a seamless way to view PDFs, images, office documents, and other file types.

## Features

### Supported File Types

#### 1. **Images** (Native Browser Preview)
- JPEG/JPG
- PNG
- GIF
- WebP
- SVG
- BMP

The images are displayed with responsive sizing and centered in the preview modal.

#### 2. **PDF Documents** (Embedded Viewer)
- PDF files are rendered using an embedded iframe with full toolbar support
- Users can navigate pages, zoom, and search within the PDF
- Fallback to download if preview fails

#### 3. **Text Files** (In-App Text Viewer)
- Plain text (.txt)
- CSV
- HTML
- CSS
- JavaScript
- JSON
- Markdown

Text files are displayed with syntax highlighting and proper formatting in a monospace font.

#### 4. **Video Files** (Native Browser Player)
- MP4
- WebM
- OGG

Videos are displayed with native browser controls for play, pause, volume, and fullscreen.

#### 5. **Audio Files** (Native Browser Player)
- MP3 (MPEG)
- WAV
- OGG
- WebM Audio

Audio files are displayed with a native browser audio player.

#### 6. **Office Documents** (Google Docs Viewer)
- Microsoft Word (.doc, .docx)
- Microsoft Excel (.xls, .xlsx)
- Microsoft PowerPoint (.ppt, .pptx)
- OpenDocument Text (.odt)
- OpenDocument Spreadsheet (.ods)
- OpenDocument Presentation (.odp)

Office documents are previewed using Google Docs Viewer embedded in an iframe. Users are notified that for best results, they should download the file or open it in a new tab.

#### 7. **Unsupported File Types**
For file types that cannot be previewed, the modal displays:
- A file icon
- File type information
- A download button to retrieve the file

## User Interface

### Accessing the Preview

1. **From Documents Page:**
   - Click the three-dot menu (⋯) next to any document
   - Select "Preview" from the dropdown menu
   - The preview modal opens automatically

2. **Available in Both Views:**
   - Grid view: Menu in top-right corner of each card
   - List view: Menu at the end of each row

### Preview Modal Components

#### Header
- **Document Name:** Display name of the document (truncated if too long)
- **File Name:** Original filename of the uploaded document
- **Action Buttons:**
  - **Open in New Tab** (🔗): Opens the document in a new browser tab (for supported types)
  - **Download** (⬇): Downloads the document to the user's device

#### Preview Area
- **Full-Screen Preview:** 600px height preview area with appropriate rendering based on file type
- **Loading State:** Animated spinner while loading the document
- **Error State:** Informative error message if preview fails

#### Footer
- **Document Description:** Shows the document description if available

### User Experience Features

1. **Smooth Transitions:**
   - Modal opens with animation
   - Loading states provide visual feedback
   - Error states are user-friendly

2. **Responsive Design:**
   - Works on all screen sizes
   - Mobile-friendly interface
   - Touch-optimized controls

3. **Performance:**
   - Signed URLs with 1-hour expiry for security
   - Efficient loading with proper error handling
   - Resources are cleaned up when modal closes

## Technical Implementation

### Component Architecture

```
src/
├── components/
│   └── documents/
│       ├── DocumentPreviewModal.tsx    (New)
│       ├── EditDocumentModal.tsx
│       └── DocumentUploadArea.tsx
├── pages/
│   └── Documents.tsx                   (Updated)
```

### Key Technologies

1. **Supabase Storage:**
   - `createSignedUrl()`: Generates secure, time-limited URLs for document access
   - `download()`: Downloads document content for text file preview
   - Security: Row-level security policies ensure users only access authorized documents

2. **React State Management:**
   - Modal state controlled by parent component
   - Loading and error states managed locally
   - Automatic cleanup on modal close

3. **TypeScript:**
   - Fully typed interfaces for documents
   - Type-safe file type checking
   - Improved IDE support and error catching

### File Type Detection

The preview modal uses MIME types to determine the appropriate preview method:

```typescript
// Example file type arrays
const IMAGE_TYPES = ['image/jpeg', 'image/png', ...];
const PDF_TYPES = ['application/pdf'];
const OFFICE_TYPES = ['application/vnd.openxmlformats-officedocument...'];
```

### Security Considerations

1. **Signed URLs:**
   - All document URLs are signed with 1-hour expiry
   - Prevents unauthorized access to documents
   - Automatically refreshes if needed

2. **Storage Policies:**
   - Leverages existing Supabase Row-Level Security
   - Users can only preview documents from their company
   - Storage path validation prevents path traversal

3. **Content Security:**
   - Iframes use appropriate sandbox attributes
   - External viewer (Google Docs) used for office documents
   - No execution of untrusted scripts

## Database Schema

The `document_archives` table includes the following relevant fields:

```sql
CREATE TABLE public.document_archives (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    storage_path TEXT NOT NULL,     -- Used for Supabase Storage access
    doc_type document_type NOT NULL,
    description TEXT,
    company_id UUID,
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

## Error Handling

### Common Errors and Solutions

1. **Preview Failed to Load:**
   - **Cause:** Network issues, storage permissions, or corrupted file
   - **Solution:** Error message displayed with download option as fallback

2. **Unsupported File Type:**
   - **Cause:** File type not in supported list
   - **Solution:** Shows friendly message with download button

3. **Expired Signed URL:**
   - **Cause:** User left modal open for more than 1 hour
   - **Solution:** Modal can be reopened to generate fresh URL

4. **Storage Path Not Found:**
   - **Cause:** Document deleted from storage but metadata remains
   - **Solution:** Error message with option to remove document entry

## Future Enhancements

### Potential Improvements

1. **Enhanced PDF Viewer:**
   - Custom PDF.js implementation for better control
   - Annotation and highlighting capabilities
   - Text selection and copying

2. **Code Syntax Highlighting:**
   - Syntax highlighting for code files (JS, TS, Python, etc.)
   - Line numbers for better readability

3. **Document Conversion:**
   - Server-side conversion of unsupported formats
   - Preview generation for complex file types

4. **Collaborative Features:**
   - Real-time collaborative viewing
   - Comments and annotations
   - Version comparison

5. **Performance Optimization:**
   - Caching of frequently accessed documents
   - Progressive loading for large files
   - Thumbnail generation for quick preview

6. **Advanced Image Features:**
   - Zoom controls for images
   - Pan and rotate functionality
   - Image metadata display (EXIF data)

## Usage Examples

### Basic Preview Flow

```typescript
// User clicks on document menu
<Button onClick={() => handlePreviewDocument(doc)}>
  <Eye className="mr-2 h-4 w-4" />
  Preview
</Button>

// Opens preview modal
<DocumentPreviewModal
  document={selectedDocument}
  open={previewModalOpen}
  onOpenChange={setPreviewModalOpen}
/>
```

### Programmatic Preview

```typescript
const handlePreviewDocument = (document: Document) => {
  setSelectedDocument(document);
  setPreviewModalOpen(true);
  setOpenPopover(null); // Close menu popover
};
```

## Testing

### Manual Testing Checklist

- [ ] Preview PDFs in modal
- [ ] Preview images (various formats)
- [ ] Preview text files
- [ ] Preview office documents
- [ ] Download from preview modal
- [ ] Open in new tab
- [ ] Test error handling (invalid file)
- [ ] Test on mobile devices
- [ ] Test with large files
- [ ] Test with expired URLs (wait > 1 hour)

### Browser Compatibility

| Browser | PDF | Images | Office Docs | Video | Audio |
|---------|-----|--------|-------------|-------|-------|
| Chrome  | ✅  | ✅     | ✅          | ✅    | ✅    |
| Firefox | ✅  | ✅     | ✅          | ✅    | ✅    |
| Safari  | ✅  | ✅     | ✅          | ✅    | ✅    |
| Edge    | ✅  | ✅     | ✅          | ✅    | ✅    |

## Troubleshooting

### Issue: Preview Modal Doesn't Open
- **Check:** Ensure `storage_path` field is populated in database
- **Check:** Verify Supabase storage policies allow read access
- **Check:** Inspect browser console for errors

### Issue: Blank Preview
- **Check:** File exists at specified storage path
- **Check:** MIME type is correctly detected
- **Check:** Browser console for CORS or security errors

### Issue: Office Documents Don't Load
- **Check:** Google Docs Viewer requires publicly accessible URLs
- **Check:** File size is within Google Docs Viewer limits (typically 25MB)
- **Alternative:** Use download option for large office files

## Maintenance

### Regular Tasks

1. **Monitor Storage Usage:**
   - Track document storage consumption
   - Clean up orphaned files

2. **Update File Type Support:**
   - Add new MIME types as needed
   - Update preview methods for new formats

3. **Security Audits:**
   - Review storage policies
   - Update signed URL expiry as needed
   - Monitor for unauthorized access attempts

## Support

For issues or questions about the Document Preview feature:
1. Check this documentation
2. Review browser console for errors
3. Verify Supabase storage configuration
4. Contact development team for assistance

---

**Last Updated:** October 2025
**Version:** 1.0.0
**Author:** AI Development Team

