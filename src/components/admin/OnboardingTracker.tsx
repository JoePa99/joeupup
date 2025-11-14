import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Users, 
  Calendar,
  MessageSquare,
  FileText,
  Target,
  TrendingUp,
  User
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CompanyWithDetails } from '@/hooks/useAdminData';

interface OnboardingTrackerProps {
  company: CompanyWithDetails;
  onBack: () => void;
}

interface OnboardingStep {
  id: string;
  step_number: number;
  title: string;
  description: string | null;
  is_required: boolean | null;
  created_at: string;
}

interface OnboardingSession {
  id: string;
  company_id: string;
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  onboarding_type: string | null;
  consultation_status: string | null;
  meeting_scheduled_at: string | null;
  website_url: string | null;
  knowledge_base_content: any;
  documents_uploaded: string[];
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: string;
  };
}

export function OnboardingTracker({ company, onBack }: OnboardingTrackerProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Fetch onboarding sessions for this company
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['onboarding-sessions', company.id],
    queryFn: async (): Promise<OnboardingSession[]> => {
      const { data, error } = await supabase
        .from('onboarding_sessions')
        .select(`
          *,
          profiles!onboarding_sessions_user_id_fkey(
            first_name,
            last_name,
            email,
            role
          )
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as OnboardingSession[];
    }
  });

  const { data: steps } = useQuery({
    queryKey: ['onboarding-steps'],
    queryFn: async (): Promise<OnboardingStep[]> => {
      const { data, error } = await supabase
        .from('onboarding_steps')
        .select('*')
        .order('step_number', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as OnboardingStep[];
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress': return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      default: return 'outline';
    }
  };

  const calculateOverallProgress = (): number => {
    if (!sessions || sessions.length === 0) return 0;
    const completed = sessions.filter(s => s.status === 'completed').length;
    return Math.round((completed / sessions.length) * 100);
  };

  const getOnboardingInsights = () => {
    if (!sessions) return {};
    
    const completed = sessions.filter(s => s.status === 'completed').length;
    const inProgress = sessions.filter(s => s.status === 'in_progress').length;
    const notStarted = sessions.filter(s => s.status === 'not_started').length;
    
    const avgTimeToComplete = sessions
      .filter(s => s.status === 'completed')
      .reduce((acc, session, _, arr) => {
        const created = new Date(session.created_at);
        const updated = new Date(session.updated_at);
        const days = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return acc + days / arr.length;
      }, 0);

    return {
      completed,
      inProgress,
      notStarted,
      avgTimeToComplete: Math.round(avgTimeToComplete || 0),
      totalUsers: sessions.length
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold">Loading Onboarding Data...</h2>
        </Card>
      </div>
    );
  }

  const insights = getOnboardingInsights();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Onboarding Progress
              </h1>
              <p className="text-text-secondary">
                Track onboarding progress for {company.name}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-primary" />
              <Badge variant="secondary">
                {calculateOverallProgress()}%
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground mb-1">{insights.totalUsers}</p>
              <p className="text-sm text-text-secondary">Total Users</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <Badge variant="default">
                {insights.completed}
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground mb-1">{insights.completed}</p>
              <p className="text-sm text-text-secondary">Completed</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <Badge variant="secondary">
                {insights.inProgress}
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground mb-1">{insights.inProgress}</p>
              <p className="text-sm text-text-secondary">In Progress</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <Badge variant="outline">
                {insights.avgTimeToComplete}d
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground mb-1">{insights.avgTimeToComplete}</p>
              <p className="text-sm text-text-secondary">Avg. Days to Complete</p>
            </div>
          </Card>
        </div>

        {/* Onboarding Sessions List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">User Onboarding Status</h2>
              <p className="text-text-secondary">Individual progress tracking for each user</p>
            </div>
          </div>

          {sessions && sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-border rounded-lg p-6 hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(session.status)}
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">
                          {session.profiles?.first_name && session.profiles?.last_name 
                            ? `${session.profiles.first_name} ${session.profiles.last_name}`
                            : session.profiles?.email || 'Unknown User'}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getStatusBadgeVariant(session.status)}>
                            {session.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {session.profiles?.role || 'user'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-text-secondary">
                        Started: {new Date(session.created_at).toLocaleDateString()}
                      </div>
                      {session.status === 'completed' && (
                        <div className="text-sm text-text-secondary">
                          Completed: {new Date(session.updated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Session Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {session.onboarding_type && (
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-text-secondary" />
                        <span className="text-sm">
                          Type: {session.onboarding_type.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    
                    {session.consultation_status && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-text-secondary" />
                        <span className="text-sm">
                          Consultation: {session.consultation_status}
                        </span>
                      </div>
                    )}
                    
                    {session.meeting_scheduled_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-text-secondary" />
                        <span className="text-sm">
                          Meeting: {new Date(session.meeting_scheduled_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Documents and Content */}
                  {(session.documents_uploaded?.length > 0 || session.website_url) && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-4">
                        {session.documents_uploaded?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-text-secondary" />
                            <span className="text-sm">
                              {session.documents_uploaded.length} document(s) uploaded
                            </span>
                          </div>
                        )}
                        
                        {session.website_url && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-blue-600">
                              Website: {session.website_url}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress Steps */}
                  {steps && steps.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Onboarding Steps</h4>
                        <span className="text-sm text-text-secondary">
                          {steps.length > 0 ? Math.round((steps.length / steps.length) * 100) : 0}% completed
                        </span>
                      </div>
                      <Progress 
                        value={steps.length > 0 ? 100 : 0}
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto mb-4 text-muted" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Onboarding Sessions</h3>
              <p className="text-text-secondary">No users have started the onboarding process yet.</p>
            </div>
          )}
        </Card>

        {/* Onboarding Steps Template */}
        {steps && steps.length > 0 && (
          <Card className="p-6 mt-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Onboarding Template</h2>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">{index + 1}</span>
                  </div>
                   <div>
                    <h4 className="font-medium text-foreground">{step.title}</h4>
                    <p className="text-sm text-text-secondary">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
