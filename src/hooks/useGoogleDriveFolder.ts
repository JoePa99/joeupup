import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/default-agent-utils';

interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  shared: boolean;
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
  shared: boolean;
}

interface CompanyDriveFolder {
  folderId: string | null;
  folderName: string | null;
}

export function useGoogleDriveFolder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user is admin or platform admin
  const { data: isAdminData } = useQuery({
    queryKey: ['user-admin-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return { isAdmin: false, isPlatformAdmin: false };

      // Check if user is company admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isCompanyAdmin = profile?.role === 'admin';

      // Check if user is platform admin
      const platformAdminResult = await isPlatformAdmin();
      const isPlatformAdminUser = platformAdminResult?.success && platformAdminResult?.isAdmin;

      return {
        isAdmin: isCompanyAdmin || isPlatformAdminUser,
        isPlatformAdmin: isPlatformAdminUser,
      };
    },
    enabled: !!user?.id,
  });

  // Get company's linked Google Drive folder
  const { data: companyFolder, isLoading: isFolderLoading } = useQuery({
    queryKey: ['company-google-drive-folder', user?.id],
    queryFn: async (): Promise<CompanyDriveFolder> => {
      if (!user?.id) return { folderId: null, folderName: null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return { folderId: null, folderName: null };

      const { data: company } = await supabase
        .from('companies')
        .select('google_drive_folder_id, google_drive_folder_name')
        .eq('id', profile.company_id)
        .single();

      return {
        folderId: company?.google_drive_folder_id || null,
        folderName: company?.google_drive_folder_name || null,
      };
    },
    enabled: !!user?.id,
  });

  // List available folders for selection
  const listFolders = async (searchQuery = ''): Promise<GoogleDriveFolder[]> => {
    const { data, error } = await supabase.functions.invoke('google-picker-list-folders', {
      body: { query: searchQuery, pageSize: 100 },
    });

    if (error) throw error;
    return data.files || [];
  };

  // Fetch files from the selected folder
  const { data: folderFiles, isLoading: isFilesLoading, error: filesError } = useQuery({
    queryKey: ['google-drive-files', companyFolder?.folderId],
    queryFn: async (): Promise<GoogleDriveFile[]> => {
      if (!companyFolder?.folderId) return [];

      const { data, error } = await supabase.functions.invoke('drive-list-files', {
        body: {
          folderId: companyFolder.folderId,
          pageSize: 50,
        },
      });

      if (error) throw error;
      return data.files || [];
    },
    enabled: !!companyFolder?.folderId,
  });

  // Update company's Google Drive folder
  const updateFolderMutation = useMutation({
    mutationFn: async ({ folderId, folderName }: { folderId: string; folderName: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');

      const { error } = await supabase
        .from('companies')
        .update({
          google_drive_folder_id: folderId,
          google_drive_folder_name: folderName,
        })
        .eq('id', profile.company_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-google-drive-folder'] });
      queryClient.invalidateQueries({ queryKey: ['google-drive-files'] });
    },
  });

  // Check if user has Google Drive integration
  const { data: hasIntegration } = useQuery({
    queryKey: ['google-drive-integration', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data } = await supabase
        .from('google_integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('drive_enabled', true)
        .maybeSingle();

      return !!data;
    },
    enabled: !!user?.id,
  });

  return {
    companyFolder,
    isFolderLoading,
    folderFiles,
    isFilesLoading,
    filesError,
    isAdmin: isAdminData?.isAdmin || false,
    isPlatformAdmin: isAdminData?.isPlatformAdmin || false,
    hasIntegration: hasIntegration || false,
    listFolders,
    updateFolder: updateFolderMutation.mutate,
    isUpdating: updateFolderMutation.isPending,
  };
}














