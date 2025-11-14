import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type OnboardingSession = Database['public']['Tables']['onboarding_sessions']['Row'];
type PlaybookSection = Database['public']['Tables']['playbook_sections']['Row'];
type ConsultationRequest = Database['public']['Tables']['consultation_requests']['Row'];

export interface PlaybookSectionWithCompany extends PlaybookSection {
  company?: {
    id: string;
    name: string;
    domain?: string;
  };
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export interface CompanyWithDetails extends Company {
  profiles: Profile[];
  onboarding_sessions: OnboardingSession[];
  playbook_sections: PlaybookSection[];
  total_agents?: number;
  total_users?: number;
  total_documents?: number;
  onboarding_completion?: number;
  playbook_completion?: number;
  last_login?: string;
}

// Hook to fetch all companies with their details (admin only)
export function useCompanies() {
  return useQuery({
    queryKey: ['admin-companies'],
    queryFn: async (): Promise<CompanyWithDetails[]> => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          profiles!inner(*, user_roles(*)),
          onboarding_sessions(*),
          playbook_sections(*),
          agents(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to include calculated fields
      return data.map((company: any) => ({
        ...company,
        total_agents: company.agents?.length || 0,
        total_users: company.profiles?.length || 0,
        total_documents: 0, // TODO: Fetch from documents table if needed
        onboarding_completion: calculateOnboardingCompletion(company.onboarding_sessions),
        playbook_completion: calculatePlaybookCompletion(company.playbook_sections),
        last_login: getLastLoginTime(company.profiles)
      }));
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch playbook sections for a specific company or all companies (admin view)
export function usePlaybookSections(companyId?: string) {
  return useQuery({
    queryKey: ['playbook-sections', companyId],
    queryFn: async (): Promise<PlaybookSectionWithCompany[]> => {
      let query = supabase
        .from('playbook_sections')
        .select(`
          *,
          profiles!playbook_sections_last_updated_by_fkey(first_name, last_name, email),
          company:companies(id, name, domain)
        `)
        .order('section_order', { ascending: true });

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    },
    enabled: !!companyId || !companyId, // Always enabled for admin
  });
}

// Hook to fetch all consultation requests (admin only)
export function useConsultationRequests() {
  return useQuery({
    queryKey: ['admin-consultation-requests'],
    queryFn: async (): Promise<ConsultationRequest[]> => {
      const { data, error } = await supabase
        .from('consultation_requests')
        .select(`
          *,
          companies(name, domain),
          profiles(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get dashboard KPIs
export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      // Fetch all necessary data in parallel
      const [
        { data: companies, error: companiesError },
        { data: agents, error: agentsError },
        { data: onboardingSessions, error: onboardingError },
        { data: playbookSections, error: playbookError },
        { data: consultationRequests, error: consultationError }
      ] = await Promise.all([
        supabase.from('companies').select('id, plan'),
        supabase.from('agents').select('id, status'),
        supabase.from('onboarding_sessions').select('id, status'),
        supabase.from('playbook_sections').select('id, status'),
        supabase.from('consultation_requests').select('id, status')
      ]);

      if (companiesError || agentsError || onboardingError || playbookError || consultationError) {
        throw new Error('Failed to fetch KPI data');
      }

      const totalClients = companies?.length || 0;
      const activeAgents = agents?.filter(a => a.status === 'active').length || 0;
      const completedOnboarding = onboardingSessions?.filter(s => s.status === 'completed').length || 0;
      const onboardingRate = onboardingSessions?.length 
        ? Math.round((completedOnboarding / onboardingSessions.length) * 100)
        : 0;
      const completedPlaybooks = playbookSections?.filter(p => p.status === 'complete').length || 0;
      const playbookCoverage = playbookSections?.length 
        ? Math.round((completedPlaybooks / playbookSections.length) * 100)
        : 0;
      
      const totalConsultationRequests = consultationRequests?.length || 0;
      const pendingConsultations = consultationRequests?.filter(c => c.status === 'requested').length || 0;
      const activeConsultations = consultationRequests?.filter(c => c.status === 'in_progress').length || 0;
      const completedConsultations = consultationRequests?.filter(c => c.status === 'completed').length || 0;

      return {
        totalClients,
        activeAgents,
        onboardingRate,
        playbookCoverage,
        totalConsultationRequests,
        pendingConsultations,
        activeConsultations,
        completedConsultations
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Mutation to update playbook section
export function useUpdatePlaybookSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string; 
      updates: Partial<PlaybookSection> 
    }) => {
      const { data, error } = await supabase
        .from('playbook_sections')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-sections'] });
    },
  });
}

// Mutation to create new playbook section
export function useCreatePlaybookSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (section: Database['public']['Tables']['playbook_sections']['Insert']) => {
      const { data, error } = await supabase
        .from('playbook_sections')
        .insert(section)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbook-sections'] });
    },
  });
}

// Hook to check if current user is admin (company-level admin)
// For platform admin access, use useIsPlatformAdmin()
export function useIsAdmin() {
  return useQuery({
    queryKey: ['user-role', 'admin-check'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('useIsAdmin: No authenticated user found');
        return false;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('useIsAdmin: Error fetching user role:', error);
        return false;
      }
      
      const isAdmin = data?.role === 'admin';
      console.log('useIsAdmin: User role check completed', { userId: user.id, role: data?.role, isAdmin });
      return isAdmin;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: true, // Always enabled, but function handles auth state
  });
}

// Hook to check if current user is platform admin
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ['user-role', 'platform-admin-check'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('useIsPlatformAdmin: No authenticated user found');
        return false;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return false;
      }

      return data?.role === 'platform-admin';
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to check if current user is company admin (admin OR platform-admin)
export function useIsCompanyAdmin() {
  return useQuery({
    queryKey: ['user-role', 'company-admin-check'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log('useIsCompanyAdmin: No authenticated user found');
        return false;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return false;
      }

      return data?.role === 'admin' || data?.role === 'platform-admin';
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper functions
function calculateOnboardingCompletion(sessions: OnboardingSession[]): number {
  if (!sessions || sessions.length === 0) return 0;
  const completed = sessions.filter(s => s.status === 'completed').length;
  return Math.round((completed / sessions.length) * 100);
}

function calculatePlaybookCompletion(sections: PlaybookSection[]): number {
  if (!sections || sections.length === 0) return 0;
  const completed = sections.filter(s => s.status === 'complete').length;
  return Math.round((completed / sections.length) * 100);
}

// Mutation to delete a company and all related data
export function useDeleteCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (companyId: string) => {
      // 1. Get all document storage paths for cleanup
      const { data: documents } = await supabase
        .from('document_archives')
        .select('storage_path')
        .eq('company_id', companyId);
      
      // 2. Delete documents from storage bucket
      if (documents && documents.length > 0) {
        const paths = documents.map(d => d.storage_path);
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove(paths);
        
        if (storageError) {
          console.warn('Failed to delete some documents from storage:', storageError);
        }
      }
      
      // 3. Get company logo for cleanup
      const { data: company } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', companyId)
        .single();
      
      // 4. Delete company logo from storage if exists
      if (company?.logo_url) {
        // Extract path from URL (assuming format like: /storage/v1/object/public/company-logos/path/to/file)
        const urlParts = company.logo_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          const { error: logoError } = await supabase.storage
            .from('company-logos')
            .remove([fileName]);
          
          if (logoError) {
            console.warn('Failed to delete company logo from storage:', logoError);
          }
        }
      }
      
      // 5. Delete the company (CASCADE handles all related data)
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);
      
      if (error) throw error;
      
      return { companyId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });
}

function getLastLoginTime(profiles: Profile[]): string {
  if (!profiles || profiles.length === 0) return 'Never';
  
  const lastLogin = profiles.reduce((latest, profile) => {
    if (!profile.last_login_at) return latest;
    const loginDate = new Date(profile.last_login_at);
    return !latest || loginDate > latest ? loginDate : latest;
  }, null as Date | null);

  if (!lastLogin) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - lastLogin.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return lastLogin.toLocaleDateString();
}
