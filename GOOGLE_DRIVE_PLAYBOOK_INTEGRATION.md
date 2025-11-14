# Google Drive Integration - Playbook Page Implementation

## Summary

Successfully added Google Drive folder integration to the Playbook.tsx page in the Documents tab.

## Changes Made

### Updated Component: DocumentManagementContent.tsx

**Location:** `src/components/documents/DocumentManagementContent.tsx`

**Changes:**
1. ✅ Added imports for `GoogleDriveFolderSelector` and `GoogleDriveFilesTab` components
2. ✅ Added `folderSelectorOpen` state to manage folder selector modal
3. ✅ Added "Google Drive" tab to the existing tabs (Browse Documents, Upload New)
4. ✅ Integrated `GoogleDriveFilesTab` component in the new tab
5. ✅ Added `GoogleDriveFolderSelector` modal at the bottom

### No Changes Required: Playbook.tsx

The Playbook.tsx page already uses `DocumentManagementContent` component, so the Google Drive functionality is automatically available without any modifications needed.

## Features Now Available in Playbook Documents Tab

### For All Users:
- View files from the company's selected Google Drive folder
- Search and filter Google Drive files
- Switch between grid and list view modes
- Open files in Google Drive (external link)
- See file metadata (type, size, modified date)

### For Admins & Platform Admins:
- Select/change the company's Google Drive folder
- Browse available folders with search
- Link a folder to the company

## User Flow

1. Navigate to **Playbook** page
2. Click on **Playbook Documents** tab
3. Click on **Google Drive** tab
4. **If Admin:** Click "Select Folder" button to choose a Google Drive folder for the company
5. **All Users:** View and search files from the selected folder

## Technical Details

- Uses existing Google OAuth integration from `google_integrations` table
- Leverages existing edge functions (`drive-list-files`, `google-picker-list-folders`)
- Folder ID and name stored in `companies` table
- Permission checks ensure only admins can change folder selection
- All company members can view files (read-only access)

## Components Reused

All components created for the Documents.tsx page are now reused in the Playbook:
- `GoogleDriveFolderSelector` - Folder selection modal
- `GoogleDriveFilesTab` - File browsing interface
- `useGoogleDriveFolder` - Custom hook for folder management

## Testing Checklist

- [ ] Admin can open folder selector from Google Drive tab
- [ ] Admin can search and select a folder
- [ ] Selected folder name displays in the company
- [ ] All users can view files from selected folder
- [ ] Files display in both grid and list views
- [ ] Search functionality works for files
- [ ] External links open files in Google Drive
- [ ] Non-admins cannot access folder selector
- [ ] Proper empty states when no folder selected
- [ ] Proper empty states when no files in folder
- [ ] Error handling for API failures

## Next Steps

1. Run migration to add columns to companies table
2. Deploy edge function for folder listing
3. Test with actual Google Drive integration
4. Verify admin permissions work correctly














