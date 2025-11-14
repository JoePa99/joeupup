import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  Paperclip,
  FileText,
  MessageSquare,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Plus,
  Edit
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  sender_type: 'admin' | 'user';
  sender_id?: string;
  sender_name: string;
  message: string;
  is_document_request: boolean;
  is_note: boolean;
  is_private_note: boolean;
  documents_requested?: string[];
  created_at: string;
}

interface ConsultationManagerProps {
  onBack?: () => void;
  hideHeader?: boolean;
}

export function ConsultationManager({ onBack, hideHeader = false }: ConsultationManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [isDocumentRequest, setIsDocumentRequest] = useState(false);
  const [documentsToRequest, setDocumentsToRequest] = useState<string[]>(['']);

  // Fetch all consultation requests
  const { data: consultationRequests, isLoading } = useQuery({
    queryKey: ['consultation-requests'],
    queryFn: async (): Promise<ConsultationRequest[]> => {
      const { data, error } = await supabase
        .from('consultation_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ConsultationRequest[];
    }
  });

  // Fetch messages for selected consultation
  const { data: messages } = useQuery({
    queryKey: ['consultation-messages', selectedRequest?.id],
    queryFn: async (): Promise<ConsultationMessage[]> => {
      if (!selectedRequest?.id) return [];

      const { data, error } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('consultation_request_id', selectedRequest.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ConsultationMessage[];
    },
    enabled: !!selectedRequest?.id
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: {
      message: string;
      isPrivateNote: boolean;
      isDocumentRequest: boolean;
      documentsRequested?: string[];
    }) => {
      if (!selectedRequest || !user) throw new Error('Missing required data');

      const { error } = await supabase
        .from('consultation_messages')
        .insert({
          consultation_request_id: selectedRequest.id,
          sender_type: 'admin',
          sender_id: user.id,
          sender_name: 'Admin Team',
          message: messageData.message,
          is_document_request: messageData.isDocumentRequest,
          is_note: messageData.isPrivateNote,
          is_private_note: messageData.isPrivateNote,
          documents_requested: messageData.documentsRequested || []
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-messages', selectedRequest?.id] });
      setNewMessage('');
      setIsPrivateNote(false);
      setIsDocumentRequest(false);
      setDocumentsToRequest(['']);
      toast.success('Message sent successfully');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedRequest) throw new Error('No request selected');

      const { error } = await supabase
        .from('consultation_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-requests'] });
      toast.success('Status updated successfully');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const documentsRequested = isDocumentRequest 
      ? documentsToRequest.filter(doc => doc.trim())
      : [];

    sendMessageMutation.mutate({
      message: newMessage.trim(),
      isPrivateNote,
      isDocumentRequest,
      documentsRequested
    });
  };

  const addDocumentField = () => {
    setDocumentsToRequest([...documentsToRequest, '']);
  };

  const updateDocumentField = (index: number, value: string) => {
    const updated = [...documentsToRequest];
    updated[index] = value;
    setDocumentsToRequest(updated);
  };

  const removeDocumentField = (index: number) => {
    setDocumentsToRequest(documentsToRequest.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'requested': { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      'in_progress': { variant: 'default' as const, icon: Users, color: 'text-blue-600' },
      'completed': { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      'on_hold': { variant: 'outline' as const, icon: AlertCircle, color: 'text-orange-600' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['requested'];
    const StatusIcon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <StatusIcon className={`h-3 w-3 ${config.color}`} />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold">Loading Consultations...</h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Consultation Management
                </h1>
                <p className="text-text-secondary">
                  Manage consultation requests and communicate with clients
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Consultation Requests List */}
          <Card className="lg:col-span-2 border border-gray-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Consultation Requests ({consultationRequests?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 p-4">
                  {consultationRequests?.map((request) => (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedRequest?.id === request.id ? 'bg-primary/10 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-sm">{request.contact_name}</h4>
                          <p className="text-xs text-muted-foreground">{request.contact_email}</p>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p><span className="font-medium">Industry:</span> {request.industry}</p>
                        <p><span className="font-medium">Company Size:</span> {request.company_size}</p>
                        <p><span className="font-medium">Revenue:</span> {request.annual_revenue}</p>
                      </div>
                      
                      <div className="mt-2 text-xs text-muted-foreground">
                        Created: {new Date(request.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  
                  {consultationRequests?.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No consultation requests</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Communication Panel */}
          <Card className="lg:col-span-3 border border-gray-200 shadow-none">
            {selectedRequest ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Communication with {selectedRequest.contact_name}
                      </CardTitle>
                      <CardDescription>
                        {selectedRequest.contact_email} • {selectedRequest.industry}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedRequest.status)}
                      <Select
                        value={selectedRequest.status}
                        onValueChange={(value) => updateStatusMutation.mutate(value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested">Requested</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Messages */}
                  <ScrollArea className="h-64 p-4 border rounded-lg">
                    <div className="space-y-4">
                      {messages?.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] space-y-2`}>
                            <div
                              className={`rounded-lg p-3 border ${
                                message.sender_type === 'admin'
                                  ? 'bg-white text-black ml-auto border-border'
                                  : 'bg-white text-black border-border'
                              }`}
                            >
                              {message.is_document_request && (
                                <div className="flex items-center gap-2 mb-2">
                                  <Paperclip className="h-4 w-4 text-black" />
                                  <span className="text-xs font-medium text-black">Document Request</span>
                                </div>
                              )}
                              {message.is_private_note && (
                                <div className="flex items-center gap-2 mb-2">
                                  <EyeOff className="h-4 w-4 text-black" />
                                  <span className="text-xs font-medium text-black">Private Note</span>
                                </div>
                              )}
                              <p className="text-sm whitespace-pre-wrap text-black">{message.message}</p>
                              {message.documents_requested && message.documents_requested.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <p className="text-xs font-medium mb-1 text-black">Requested Documents:</p>
                                  <ul className="text-xs list-disc list-inside text-black">
                                    {message.documents_requested.map((doc, index) => (
                                      <li key={index}>{doc}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className={`flex items-center gap-2 text-xs text-muted-foreground ${
                              message.sender_type === 'admin' ? 'justify-end' : 'justify-start'
                            }`}>
                              <span>{message.sender_name}</span>
                              <span>•</span>
                              <span>{new Date(message.created_at).toLocaleString()}</span>
                              {message.is_note && (
                                <Badge variant="outline" className="text-xs">
                                  {message.is_private_note ? 'Private Note' : 'Note'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {messages?.length === 0 && (
                        <div className="text-center py-8">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            No messages yet. Start the conversation!
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Message Composer */}
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="private-note"
                          checked={isPrivateNote}
                          onCheckedChange={setIsPrivateNote}
                        />
                        <Label htmlFor="private-note" className="text-sm">
                          Private Admin Note
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="document-request"
                          checked={isDocumentRequest}
                          onCheckedChange={setIsDocumentRequest}
                        />
                        <Label htmlFor="document-request" className="text-sm">
                          Document Request
                        </Label>
                      </div>
                    </div>

                    {isDocumentRequest && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Documents to Request:</Label>
                        {documentsToRequest.map((doc, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              placeholder="e.g., Business plan, Financial statements"
                              value={doc}
                              onChange={(e) => updateDocumentField(index, e.target.value)}
                            />
                            {documentsToRequest.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeDocumentField(index)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addDocumentField}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Document
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Textarea
                        placeholder={
                          isPrivateNote 
                            ? "Write a private admin note..." 
                            : isDocumentRequest
                            ? "Explain why these documents are needed..."
                            : "Send a message to the client..."
                        }
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="resize-none"
                        rows={3}
                      />
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          {isPrivateNote && (
                            <span className="text-foreground">
                              <EyeOff className="h-3 w-3 inline mr-1" />
                              This note will only be visible to admins
                            </span>
                          )}
                          {isDocumentRequest && !isPrivateNote && (
                            <span className="text-foreground">
                              <Paperclip className="h-3 w-3 inline mr-1" />
                              This will request documents from the client
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Select a Consultation Request
                  </h3>
                  <p className="text-muted-foreground">
                    Choose a request from the list to start communicating
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

