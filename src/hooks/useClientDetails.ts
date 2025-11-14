import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  logo_url: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  company_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  settings: any;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ConsultationRequest {
  id: string;
  company_id: string;
  user_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  company_size: string | null;
  annual_revenue: string | null;
  business_background: string | null;
  goals_objectives: string | null;
  current_challenges: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DocumentArchive {
  id: string;
  company_id: string;
  uploaded_by: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  doc_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface OnboardingSession {
  id: string;
  company_id: string;
  user_id: string;
  current_step: number;
  status: string;
  progress_percentage: number;
  completed_steps: number[];
  session_data: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  onboarding_type?: string;
}

interface PlaybookSection {
  id: string;
  company_id: string;
  section_order: number;
  title: string;
  content: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
}

interface Agent {
  id: string;
  company_id: string;
  name: string;
  role: string;
  status: string;
  description: string | null;
  configuration: any;
  avatar_url: string | null;
  agent_type_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultationWithDetails extends ConsultationRequest {
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface DocumentWithUploader extends DocumentArchive {
  uploader?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface ClientDetails {
  // Company fields
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  logo_url: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
  
  // Related users/profiles
  profiles: Profile[];
  
  // Business documents
  documents: DocumentWithUploader[];
  
  // Consultation requests
  consultation_requests: ConsultationWithDetails[];
  
  // Onboarding progress
  onboarding_sessions: OnboardingSession[];
  
  // Playbook sections
  playbook_sections: PlaybookSection[];
  
  // AI Agents
  agents: Agent[];
  
  // Channels and messages
  channels: any[];
  total_channels: number;
  total_messages: number;
  active_users_count: number;
  
  // Computed fields
  total_users: number;
  total_documents: number;
  onboarding_completion: number;
  playbook_completion: number;
  last_activity: string;
  consultation_status: 'none' | 'requested' | 'in_progress' | 'completed';
}

export function useClientDetails(clientId: string) {
  return useQuery({
    queryKey: ['client-details', clientId],
    queryFn: async (): Promise<ClientDetails> => {
      // Fetch company details with all related data
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', clientId)
        .single();

      if (companyError) throw companyError;
      if (!company) throw new Error('Client not found');

      // Fetch all related data in parallel for better performance
      const [
        { data: profiles, error: profilesError },
        { data: documents, error: documentsError },
        { data: consultations, error: consultationsError },
        { data: onboardingSessions, error: onboardingError },
        { data: playbookSections, error: playbookError },
        { data: agents, error: agentsError },
        { data: channels, error: channelsError }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('company_id', clientId),
        
        supabase
          .from('document_archives')
          .select(`
            *,
            uploader:profiles!uploaded_by(id, email, first_name, last_name)
          `)
          .eq('company_id', clientId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('consultation_requests')
          .select(`
            *,
            profiles(id, first_name, last_name, email, avatar_url)
          `)
          .eq('company_id', clientId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('onboarding_sessions')
          .select('*')
          .eq('company_id', clientId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('playbook_sections')
          .select('*')
          .eq('company_id', clientId)
          .order('section_order', { ascending: true }),
        
        supabase
          .from('agents')
          .select('*')
          .eq('company_id', clientId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('channels')
          .select('*')
          .eq('company_id', clientId)
          .order('created_at', { ascending: false })
      ]);

      if (profilesError) throw profilesError;
      if (documentsError) throw documentsError;
      if (consultationsError) throw consultationsError;
      if (onboardingError) throw onboardingError;
      if (playbookError) throw playbookError;
      if (agentsError) throw agentsError;
      if (channelsError) throw channelsError;

      // Calculate computed fields
      const totalUsers = profiles?.length || 0;
      const totalDocuments = documents?.length || 0;
      const totalChannels = channels?.length || 0;
      
      // Calculate total messages across all channels and conversations
      const { count: channelMessagesCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('channel_id', channels?.map(c => c.id) || []);
      
      const { count: conversationMessagesCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', 
          (await supabase
            .from('chat_conversations')
            .select('id')
            .eq('company_id', clientId)
          ).data?.map(c => c.id) || []
        );
      
      const totalMessages = (channelMessagesCount || 0) + (conversationMessagesCount || 0);
      
      // Calculate active users (logged in within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeUsersCount = profiles?.filter(p => 
        p.last_login_at && new Date(p.last_login_at) > sevenDaysAgo
      ).length || 0;
      
      // Calculate onboarding completion percentage
      const completedOnboarding = onboardingSessions?.filter(
        session => session.status === 'completed'
      ).length || 0;
      const onboardingCompletion = onboardingSessions?.length
        ? Math.round((completedOnboarding / onboardingSessions.length) * 100)
        : 0;

      // Calculate playbook completion percentage
      const completedPlaybook = playbookSections?.filter(
        section => section.status === 'complete'
      ).length || 0;
      const playbookCompletion = playbookSections?.length
        ? Math.round((completedPlaybook / playbookSections.length) * 100)
        : 0;

      // Determine consultation status
      const latestConsultation = consultations?.[0];
      let consultationStatus: 'none' | 'requested' | 'in_progress' | 'completed' = 'none';
      if (latestConsultation) {
        consultationStatus = latestConsultation.status as 'requested' | 'in_progress' | 'completed';
      }

      // Find most recent activity
      const activities = [
        ...(profiles?.map(p => ({ date: p.last_login_at || p.created_at, type: 'login' })) || []),
        ...(documents?.map(d => ({ date: d.created_at, type: 'document' })) || []),
        ...(consultations?.map(c => ({ date: c.updated_at, type: 'consultation' })) || []),
        ...(onboardingSessions?.map(o => ({ date: o.updated_at, type: 'onboarding' })) || [])
      ].filter(activity => activity.date);

      const lastActivity = activities.length > 0
        ? new Date(Math.max(...activities.map(a => new Date(a.date).getTime())))
        : new Date(company.created_at);

      const lastActivityFormatted = formatLastActivity(lastActivity);

      return {
        ...company,
        profiles: profiles || [],
        documents: documents as DocumentWithUploader[] || [],
        consultation_requests: consultations as ConsultationWithDetails[] || [],
        onboarding_sessions: onboardingSessions || [],
        playbook_sections: playbookSections || [],
        agents: agents || [],
        channels: channels || [],
        total_users: totalUsers,
        total_documents: totalDocuments,
        total_channels: totalChannels,
        total_messages: totalMessages,
        active_users_count: activeUsersCount,
        onboarding_completion: onboardingCompletion,
        playbook_completion: playbookCompletion,
        last_activity: lastActivityFormatted,
        consultation_status: consultationStatus
      };
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Helper function to format last activity time
function formatLastActivity(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}


