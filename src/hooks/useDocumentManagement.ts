import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

export interface DocumentWithDetails {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  doc_type: DocumentType;
  description: string | null;
  storage_path: string;
  company_id: string | null;
  tags: string[] | null;
  is_current_version: boolean | null;
  version_number: number | null;
  // Joined data
  company?: {
    id: string;
    name: string;
    domain: string | null;
  };
  uploader?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

// Hook to fetch all documents across all companies (admin only)
export function useAdminDocuments(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin-documents'],
    queryFn: async (): Promise<DocumentWithDetails[]> => {
      const { data, error } = await supabase
        .from('document_archives')
        .select(`
          *,
          company:companies(id, name, domain),
          uploader:profiles!uploaded_by(id, email, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as DocumentWithDetails[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

// Hook to fetch documents for a specific company (admin view)
export function useCompanyDocuments(companyId?: string) {
  return useQuery({
    queryKey: ['company-documents', companyId],
    queryFn: async (): Promise<DocumentWithDetails[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('document_archives')
        .select(`
          *,
          company:companies(id, name, domain),
          uploader:profiles!uploaded_by(id, email, first_name, last_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data as DocumentWithDetails[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get document statistics by company
export function useDocumentStats() {
  return useQuery({
    queryKey: ['document-stats'],
    queryFn: async () => {
      // Get all documents with company info
      const { data: documents, error } = await supabase
        .from('document_archives')
        .select(`
          id,
          file_size,
          doc_type,
          company_id,
          created_at,
          company:companies(id, name)
        `);

      if (error) throw error;

      // Calculate statistics
      const totalDocuments = documents?.length || 0;
      const totalSize = documents?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;
      
      // Group by company
      const byCompany = documents?.reduce((acc, doc) => {
        const companyId = doc.company_id;
        const companyName = doc.company?.name || 'Unknown';
        
        if (!acc[companyId || 'unknown']) {
          acc[companyId || 'unknown'] = {
            id: companyId,
            name: companyName,
            documentCount: 0,
            totalSize: 0,
            types: new Set<string>()
          };
        }
        
        acc[companyId || 'unknown'].documentCount++;
        acc[companyId || 'unknown'].totalSize += doc.file_size || 0;
        acc[companyId || 'unknown'].types.add(doc.doc_type);
        
        return acc;
      }, {} as Record<string, any>) || {};

      // Group by document type
      const byType = documents?.reduce((acc, doc) => {
        const type = doc.doc_type;
        if (!acc[type]) {
          acc[type] = {
            type,
            count: 0,
            size: 0
          };
        }
        acc[type].count++;
        acc[type].size += doc.file_size || 0;
        return acc;
      }, {} as Record<string, any>) || {};

      return {
        totalDocuments,
        totalSize,
        companiesWithDocuments: Object.keys(byCompany).length,
        byCompany: Object.values(byCompany),
        byType: Object.values(byType)
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook to delete a document (admin only)
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      // First get the document info to get the storage path
      const { data: document, error: fetchError } = await supabase
        .from('document_archives')
        .select('storage_path')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.storage_path]);

      if (storageError) {
        console.warn('Failed to delete from storage:', storageError);
      }

      // Delete from database (this will cascade to related tables)
      const { error: dbError } = await supabase
        .from('document_archives')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      return { documentId };
    },
    onSuccess: () => {
      // Invalidate all document-related queries
      queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      queryClient.invalidateQueries({ queryKey: ['company-documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    },
  });
}

// Hook to update document metadata (admin only)
export function useUpdateDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      documentId, 
      updates 
    }: { 
      documentId: string; 
      updates: Partial<Pick<DocumentWithDetails, 'name' | 'description' | 'doc_type' | 'tags'>>
    }) => {
      const { data, error } = await supabase
        .from('document_archives')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all document-related queries
      queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      queryClient.invalidateQueries({ queryKey: ['company-documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
    },
  });
}

// Hook to download a document
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (doc: DocumentWithDetails) => {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (error) throw error;

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the access
      await supabase
        .from('document_access_logs')
        .insert({
          document_id: doc.id,
          action: 'download',
          ip_address: null, // Could be populated with actual IP
          user_agent: navigator.userAgent
        });

      return doc;
    },
  });
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to get document type display name
export function getDocumentTypeDisplayName(type: DocumentType): string {
  const displayNames: Record<DocumentType, string> = {
    sop: 'SOP',
    contract: 'Contract',
    manual: 'Manual',
    policy: 'Policy',
    template: 'Template',
    other: 'Other'
  };
  return displayNames[type] || type;
}

// Helper function to get document type color
export function getDocumentTypeColor(type: DocumentType): string {
  const colors: Record<DocumentType, string> = {
    sop: 'bg-blue-100 text-blue-800',
    contract: 'bg-green-100 text-green-800',
    manual: 'bg-purple-100 text-purple-800',
    policy: 'bg-orange-100 text-orange-800',
    template: 'bg-pink-100 text-pink-800',
    other: 'bg-gray-100 text-gray-800'
  };
  return colors[type] || colors.other;
}


