# Playbook Management System

## Overview

The Playbook Management system allows company admins (users with admin role within their company) to create, manage, and maintain structured knowledge bases with rich text editing capabilities. The system includes two main components:

1. **Playbook Sections**: Structured content management with versioning and activity tracking
2. **Playbook Documents**: Integration with the existing document management system

## Features

### Playbook Sections

- **Rich Text Editor**: TipTap-based editor with formatting options (bold, italic, lists, quotes, links)
- **Section Templates**: Pre-defined templates for common business sections:
  - Mission & Vision
  - Value Proposition
  - Customer Segments
  - SWOT Analysis
  - Standard Operating Procedures
  - Team Roles & Responsibilities
  - Tools & Integrations
  - Compliance & Legal

- **Version Control**: Automatic versioning when content changes
- **Activity Logging**: Track all changes with user attribution
- **Status Management**: Draft, In Progress, Complete states
- **Progress Tracking**: Visual progress indicators

### Playbook Documents

- **Document Creation**: Create structured documents from playbook content
- **Rich Text Editor**: Same TipTap editor for consistent experience
- **Knowledge Base Integration**: Direct integration with embedding system
- **Document Types**: Categorized by playbook section type
- **Storage**: Documents stored in Supabase Storage as Markdown files

## Technical Architecture

### Components

#### Core Components
- `src/pages/Playbook.tsx` - Main playbook page with tabs
- `src/components/admin/PlaybookManager.tsx` - Sections management
- `src/components/playbook/rich-text-editor.tsx` - TipTap editor wrapper
- `src/components/playbook/CreatePlaybookDocumentModal.tsx` - Document creation modal

#### Utilities
- `src/lib/playbook.ts` - Core business logic and API functions

### Database Schema

#### Tables Used
- `playbook_sections` - Main section storage
- `playbook_section_versions` - Version history
- `playbook_activity` - Activity audit trail
- `document_archives` - Document metadata
- `playbook_documents` - Optional linking table

#### Key Fields
```sql
-- playbook_sections
- id (uuid, primary key)
- company_id (uuid, foreign key)
- title (text)
- content (text)
- tags (text[])
- status (playbook_status enum)
- section_order (integer)
- progress_percentage (integer)
- created_at, updated_at (timestamps)
- last_updated_by (uuid, foreign key)

-- playbook_section_versions
- id (uuid, primary key)
- section_id (uuid, foreign key)
- title (text)
- content (text)
- version_notes (text)
- created_by (uuid, foreign key)
- created_at (timestamp)

-- playbook_activity
- id (uuid, primary key)
- section_id (uuid, foreign key)
- action (text)
- user_id (uuid, foreign key)
- company_id (uuid, foreign key)
- metadata (jsonb)
- created_at (timestamp)
```

### API Functions

#### Document Management
```typescript
// Create a playbook document
createPlaybookDocument(data: PlaybookDocumentData, addToKnowledgeBase?: boolean)

// Process document for embeddings
processDocumentForKnowledgeBase(documentId: string, companyId: string)
```

#### Section Management
```typescript
// Save/update section
savePlaybookSection(data: PlaybookSectionData, sectionId?: string)

// Create version snapshot
createPlaybookVersion(sectionId: string, content: string, versionNotes?: string)

// Log activity
logPlaybookActivity(sectionId: string, action: string, companyId: string, userId?: string)
```

#### Data Retrieval
```typescript
// Get sections
getPlaybookSections(companyId: string)

// Get versions
getPlaybookVersions(sectionId: string)

// Get activity
getPlaybookActivity(sectionId?: string, companyId?: string)
```

## User Workflows

### Creating a New Section

1. Navigate to Playbook → Sections tab
2. Click "New Section" or use a template
3. Fill in title and content using rich text editor
4. Set status and tags
5. Save - automatically creates version and logs activity

### Creating a Document

1. Click "Create Document" in Playbook Manager
2. Select section type from dropdown
3. Enter title and description
4. Write content using rich text editor
5. Choose "Save Draft" or "Save & Add to Knowledge Base"
6. Document is converted to Markdown, uploaded to storage, and optionally processed for embeddings

### Managing Versions

1. Click "Version History" in Playbook Manager
2. View all versions with timestamps and authors
3. Restore previous versions if needed
4. View detailed change history

## Integration Points

### Document Processing Pipeline

1. **Content Creation**: Rich text editor generates HTML
2. **Conversion**: HTML converted to Markdown using custom parser
3. **Storage**: Markdown file uploaded to Supabase Storage
4. **Metadata**: Document record created in `document_archives`
5. **Embeddings**: Optional processing via existing `process-documents` edge function
6. **Agent Integration**: Documents available to company agents via vector stores

### Existing System Integration

- **Document Management**: Reuses existing Documents page component
- **Embeddings**: Uses existing `process-documents` Supabase function
- **Storage**: Uses existing `documents` Supabase storage bucket
- **Authentication**: Uses existing admin protection and auth context
- **UI Components**: Built on existing Shadcn/UI component library

## Security & Permissions

- **Company Admin Only**: All playbook features restricted to users with admin role within their company
- **Company Isolation**: All data scoped to company_id (admins can only manage their own company's playbook)
- **Row Level Security**: Supabase RLS policies enforce data access
- **Activity Tracking**: All changes logged with user attribution

## Performance Considerations

- **React Query**: Caching for sections, versions, and activity data
- **Lazy Loading**: TipTap editor loaded on demand
- **Debounced Saves**: Prevent excessive API calls during editing
- **Optimistic Updates**: UI updates before server confirmation

## Future Enhancements

### Planned Features
- **Collaborative Editing**: Real-time collaborative editing
- **Template Library**: Shared template marketplace
- **Advanced Analytics**: Usage and engagement metrics
- **Export Options**: PDF, Word, and other format exports
- **Workflow Integration**: Approval workflows for section publishing

### Technical Improvements
- **Offline Support**: Offline editing with sync
- **Advanced Search**: Full-text search across all sections
- **API Rate Limiting**: Better handling of concurrent edits
- **Performance Monitoring**: Detailed performance metrics

## Troubleshooting

### Common Issues

1. **Editor Not Loading**
   - Check TipTap dependencies in package.json
   - Verify editor component imports

2. **Document Upload Fails**
   - Check Supabase storage permissions
   - Verify file size limits (10MB default)

3. **Embeddings Not Working**
   - Verify OpenAI API key configuration
   - Check agent vector store setup
   - Review `process-documents` function logs

4. **Version History Missing**
   - Check `playbook_section_versions` table permissions
   - Verify version creation in save handlers

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=playbook:*
```

This will log all playbook-related operations including:
- Section saves and updates
- Document creation and processing
- Version creation
- Activity logging

## Testing

### Unit Tests

Run playbook utility tests:
```bash
npm test src/lib/__tests__/playbook.test.ts
```

### Integration Tests

Test the complete workflow:
1. Create a new section
2. Edit content with rich text editor
3. Create a document from the section
4. Verify document appears in Documents tab
5. Check embeddings processing (if enabled)

### Manual Testing Checklist

- [ ] Admin can access Playbook page
- [ ] Sections tab displays existing sections
- [ ] Rich text editor loads and functions
- [ ] New sections can be created
- [ ] Existing sections can be edited
- [ ] Version history is created on edits
- [ ] Activity logs are created
- [ ] Documents can be created from sections
- [ ] Documents appear in Documents tab
- [ ] Embeddings processing works (if enabled)
- [ ] Non-admin users cannot access Playbook page
