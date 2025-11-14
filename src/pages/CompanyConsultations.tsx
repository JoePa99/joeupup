import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { CompanyAdminProtectedRoute } from "@/components/auth/CompanyAdminProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MessageSquare,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Upload,
  Send,
  Paperclip,
  Eye,
  EyeOff
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentUploadArea } from '@/components/documents/DocumentUploadArea';

interface ConsultationRequest {
  id: string;
  company_id: string | null;
  user_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company_size: string | null;
  industry: string | null;
  annual_revenue: string | null;
  business_background: string | null;
  goals_objectives: string | null;
  current_challenges: string | null;
  target_market: string | null;
  competitive_landscape: string | null;
  preferred_meeting_times: string | null;
  additional_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ConsultationMessage {
  id: string;
  consultation_request_id: string;
  sender_type: string;
  sender_id: string | null;
  sender_name: string;
  message: string;
  is_document_request: boolean;
  is_note: boolean;
  is_private_note: boolean;
  documents_requested: string[];
  created_at: string;
  updated_at: string;
}

interface ConsultationProgress {
  id: string;
  consultation_request_id: string;
  current_step: number;
  step_name: string;
  step_description: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function CompanyConsultationsContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showUploadArea, setShowUploadArea] = useState(false);

  // Fetch company's consultation requests
  const { data: consultationRequests, isLoading } = useQuery({
    queryKey: ['company-consultation-requests'],
    queryFn: async (): Promise<ConsultationRequest[]> => {
      if (!user?.id) return [];

      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from('consultation_requests' as any)
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ConsultationRequest[];
    },
    enabled: !!user?.id
  });

  // Fetch messages for selected consultation
  const { data: messages } = useQuery({
    queryKey: ['consultation-messages', selectedRequest?.id],
    queryFn: async (): Promise<ConsultationMessage[]> => {
      if (!selectedRequest?.id) return [];

      const { data, error } = await supabase
        .from('consultation_messages' as any)
        .select('*')
        .eq('consultation_request_id', selectedRequest.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as ConsultationMessage[];
    },
    enabled: !!selectedRequest?.id
  });

  // Fetch progress for selected consultation (optional - table might not exist)
  const { data: progress } = useQuery({
    queryKey: ['consultation-progress', selectedRequest?.id],
    queryFn: async (): Promise<ConsultationProgress[]> => {
      if (!selectedRequest?.id) return [];

      try {
        const { data, error } = await supabase
          .from('consultation_progress' as any)
          .select('*')
          .eq('consultation_request_id', selectedRequest.id)
          .order('current_step', { ascending: true });

        if (error) {
          console.warn('consultation_progress table not found or accessible:', error);
          return [];
        }
        return (data || []) as unknown as ConsultationProgress[];
      } catch (error) {
        console.warn('Error fetching consultation progress:', error);
        return [];
      }
    },
    enabled: !!selectedRequest?.id
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedRequest || !user) throw new Error('Missing required data');

      const { error } = await supabase
        .from('consultation_messages' as any)
        .insert({
          consultation_request_id: selectedRequest.id,
          sender_type: 'user',
          sender_id: user.id,
          sender_name: user.user_metadata?.first_name || user.email || 'User',
          message: message.trim(),
          is_document_request: false,
          is_note: false,
          is_private_note: false
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-messages', selectedRequest?.id] });
      setNewMessage('');
      toast.success('Message sent successfully');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedRequest?.id) return;

    const channel = supabase
      .channel(`consultation-messages-${selectedRequest.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'consultation_messages',
          filter: `consultation_request_id=eq.${selectedRequest.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['consultation-messages', selectedRequest.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRequest?.id, queryClient]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      requested: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      on_hold: { color: 'bg-gray-100 text-gray-800', icon: Clock }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - Consultation requests list */}
      <div className="w-1/3 border-r border-border">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Consultation Requests</h2>
          <p className="text-sm text-muted-foreground">
            Track your company's consultation progress
          </p>
        </div>
        
        <ScrollArea className="h-[calc(100vh-120px)]">
          {consultationRequests?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No consultation requests yet</p>
            </div>
          ) : (
            <div className="p-2">
              {consultationRequests?.map((request) => (
                <Card
                  key={request.id}
                  className={`mb-2 cursor-pointer transition-colors ${
                    selectedRequest?.id === request.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">
                          {request.contact_name || 'Unnamed Request'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {request.contact_email}
                        </p>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(request.created_at)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right side - Selected consultation details */}
      <div className="flex-1 flex flex-col">
        {selectedRequest ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedRequest.contact_name || 'Consultation Request'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.contact_email} • {selectedRequest.industry}
                  </p>
                </div>
                {getStatusBadge(selectedRequest.status)}
              </div>
            </div>

            {/* Progress stepper */}
            {progress && progress.length > 0 && (
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="text-sm font-medium mb-3">Progress</h3>
                <div className="flex items-center space-x-4">
                  {progress.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        step.completed_at 
                          ? 'bg-green-500 text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.completed_at ? <CheckCircle className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="ml-2">
                        <p className="text-sm font-medium">{step.step_name}</p>
                        {step.step_description && (
                          <p className="text-xs text-muted-foreground">{step.step_description}</p>
                        )}
                      </div>
                      {index < progress.length - 1 && (
                        <div className="w-8 h-px bg-border mx-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages
                    ?.filter(msg => !msg.is_private_note) // Hide private notes from company view
                    .map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] ${message.sender_type === 'admin' ? 'mr-auto' : 'ml-auto'}`}>
                        <div className="flex items-center mb-1">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback className="text-xs">
                              {getInitials(message.sender_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{message.sender_name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                        
                        <Card className={`border ${
                          message.sender_type === 'admin' 
                            ? 'bg-white text-black' 
                            : 'bg-white text-black'
                        }`}>
                          <CardContent className="p-3">
                            {message.is_document_request && (
                              <div className="mb-2 p-2 border border-orange-200 rounded text-xs">
                                <div className="flex items-center mb-1">
                                  <Paperclip className="h-3 w-3 mr-1 text-black" />
                                  <strong className="text-black">Document Request</strong>
                                </div>
                                {message.documents_requested.length > 0 && (
                                  <ul className="list-disc list-inside text-black">
                                    {message.documents_requested.map((doc, idx) => (
                                      <li key={idx}>{doc}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                            
                            {message.is_note && (
                              <div className="mb-2 p-2 border border-blue-200 rounded text-xs">
                                <div className="flex items-center">
                                  <FileText className="h-3 w-3 mr-1 text-black" />
                                  <strong className="text-black">Note</strong>
                                </div>
                              </div>
                            )}
                            
                            <p className="text-sm whitespace-pre-wrap text-black">{message.message}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message input */}
            <div className="p-4 border-t border-border">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 min-h-[60px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <div className="flex flex-col space-y-2">
                  <Button
                    onClick={() => setShowUploadArea(!showUploadArea)}
                    variant="outline"
                    size="sm"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {showUploadArea && (
                <div className="mt-4">
                  <DocumentUploadArea
                    onUploadComplete={() => {
                      setShowUploadArea(false);
                      toast.success('Documents uploaded successfully');
                    }}
                    onClose={() => setShowUploadArea(false)}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a consultation request</h3>
              <p>Choose a request from the list to view messages and progress</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanyConsultations() {
  return (
    <CompanyAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <header className="flex h-16 items-center gap-4 border-b px-6">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Consultations</h2>
            </header>
            <CompanyConsultationsContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </CompanyAdminProtectedRoute>
  );
}
