import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Clock, 
  CheckCircle, 
  Users, 
  Calendar, 
  MessageSquare, 
  FileText, 
  Upload,
  AlertCircle,
  Send,
  Paperclip,
  Eye,
  EyeOff
} from "lucide-react";

interface ConsultationMessage {
  id: string;
  consultation_request_id: string;
  sender_type: 'admin' | 'user';
  sender_name: string;
  message: string;
  is_document_request: boolean;
  is_note: boolean;
  is_private_note: boolean;
  created_at: string;
  documents_requested?: string[];
}

interface ConsultationRequest {
  id: string;
  company_id: string;
  user_id: string;
  status: 'requested' | 'in_progress' | 'completed' | 'on_hold';
  contact_name: string;
  contact_email: string;
  business_background: string;
  created_at: string;
  updated_at: string;
}

interface DocumentUpload {
  id: string;
  filename: string;
  uploaded_at: string;
  file_url: string;
}

const CONSULTATION_STEPS = [
  {
    id: 1,
    title: "Consultation Request Submitted",
    description: "Your consultation request has been received"
  },
  {
    id: 2,
    title: "Initial Review",
    description: "Our team is reviewing your business information"
  },
  {
    id: 3,
    title: "Meeting Scheduled",
    description: "Consultation meeting scheduled with our experts"
  },
  {
    id: 4,
    title: "Research Phase",
    description: "Deep business analysis and research in progress"
  },
  {
    id: 5,
    title: "Knowledge Base Creation",
    description: "70+ page knowledge base being compiled"
  },
  {
    id: 6,
    title: "Review & Finalization",
    description: "Final review and agent deployment preparation"
  }
];

export function ConsultationProgressTracker() {
  const { user } = useAuth();
  const [consultationRequest, setConsultationRequest] = useState<ConsultationRequest | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (user) {
      fetchConsultationData();
    }
  }, [user]);

  const fetchConsultationData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch consultation request
      const { data: consultation, error: consultationError } = await supabase
        .from('consultation_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (consultationError) throw consultationError;
      
      if (consultation) {
        setConsultationRequest(consultation as any); // Type assertion for now
        
        // Determine current step based on status
        const stepMap = {
          'requested': 1,
          'in_progress': 3,
          'completed': 6,
          'on_hold': 2
        };
        setCurrentStep(stepMap[consultation.status as keyof typeof stepMap] || 1);

        // Fetch messages
        await fetchMessages(consultation.id);
        
        // Fetch documents
        await fetchDocuments(consultation.id);
      }
    } catch (error) {
      console.error('Error fetching consultation data:', error);
      toast.error('Failed to load consultation data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (consultationId: string) => {
    try {
      const { data, error } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('consultation_request_id', consultationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as any); // Use type assertion for now
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchDocuments = async (consultationId: string) => {
    try {
      // Note: consultation_documents table doesn't exist yet - commenting out for now
      // const { data, error } = await supabase
      //   .from('consultation_documents')
      //   .select('*')
      //   .eq('consultation_request_id', consultationId)
      //   .order('uploaded_at', { ascending: false });

      // if (error) throw error;
      setDocuments([]); // Empty for now until table is created
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !consultationRequest) return;

    try {
      const { error } = await supabase
        .from('consultation_messages')
        .insert({
          consultation_request_id: consultationRequest.id,
          sender_type: 'user',
          sender_name: consultationRequest.contact_name,
          message: newMessage.trim(),
          is_document_request: false,
          is_note: false,
          is_private_note: false
        });

      if (error) throw error;

      setNewMessage("");
      await fetchMessages(consultationRequest.id);
      toast.success("Message sent to consultation team");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !consultationRequest) return;

    const fileArray = Array.from(files);
    setUploadingFiles(fileArray);

    try {
      for (const file of fileArray) {
        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${consultationRequest.id}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('consultation-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('consultation-documents')
          .getPublicUrl(fileName);

        // Note: Document upload functionality disabled until consultation_documents table is created
        console.log('Document upload not implemented yet - table does not exist');
        // const { error: docError } = await supabase
        //   .from('consultation_documents')
        //   .insert({
        //     consultation_request_id: consultationRequest.id,
        //     filename: file.name,
        //     file_url: publicUrl,
        //     uploaded_by: user?.id
        //   });

        // if (docError) throw docError;
      }

      await fetchDocuments(consultationRequest.id);
      toast.success(`${fileArray.length} document(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload documents');
    } finally {
      setUploadingFiles([]);
    }
  };

  const getProgressPercentage = () => {
    return Math.round((currentStep / CONSULTATION_STEPS.length) * 100);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'requested': { variant: 'secondary' as const, text: 'Submitted' },
      'in_progress': { variant: 'default' as const, text: 'In Progress' },
      'completed': { variant: 'default' as const, text: 'Completed' },
      'on_hold': { variant: 'outline' as const, text: 'On Hold' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['requested'];
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading consultation progress...</p>
        </div>
      </div>
    );
  }

  if (!consultationRequest) {
    return (
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle>No Consultation Request Found</CardTitle>
          <CardDescription>
            Please complete the onboarding process to request a consultation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Consultation Service Progress
              </CardTitle>
              <CardDescription>
                Track your personalized onboarding consultation with our expert team
              </CardDescription>
            </div>
            {getStatusBadge(consultationRequest.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Progress: Step {currentStep} of {CONSULTATION_STEPS.length}</span>
              <span>{getProgressPercentage()}% Complete</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Progress Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultation Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {CONSULTATION_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    step.id <= currentStep 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.id <= currentStep ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-medium">{step.id}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className={`font-medium text-sm ${
                      step.id === currentStep ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Communication */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Communication
            </CardTitle>
            <CardDescription>
              Stay in touch with our consultation team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <ScrollArea className="h-64 p-4 border rounded-lg">
              <div className="space-y-4">
                {messages.filter(msg => !msg.is_private_note).map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-2`}>
                      <div
                        className={`rounded-lg p-3 border ${
                          message.sender_type === 'user'
                            ? 'bg-white text-black ml-auto border-border'
                            : 'bg-white text-black border-border'
                        } ${message.is_document_request ? 'border-l-4 border-orange-500' : ''}`}
                      >
                        {message.is_document_request && (
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="h-4 w-4 text-black" />
                            <span className="text-xs font-medium text-black">Document Request</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap text-black">{message.message}</p>
                      </div>
                      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${
                        message.sender_type === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        <span>{message.sender_name}</span>
                        <span>•</span>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                        {message.is_note && (
                          <Badge variant="outline" className="text-xs">Note</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No messages yet. Our team will reach out soon!
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Send a message to your consultation team..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="resize-none"
                  rows={2}
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* File Upload */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploadingFiles.length > 0}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFiles.length > 0 ? 'Uploading...' : 'Upload Documents'}
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <span className="text-xs text-muted-foreground">
                  PDF, DOC, DOCX, TXT (Max 10MB each)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Uploaded Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(doc.file_url, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {consultationRequest.status === 'requested' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Awaiting Team Response</span>
                </div>
                <p className="text-sm text-blue-800">
                  Our expert team will review your submission and reach out within 24-48 hours to schedule your consultation.
                </p>
              </div>
            )}
            
            {consultationRequest.status === 'in_progress' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">Consultation Active</span>
                </div>
                <p className="text-sm text-green-800">
                  Our team is actively working on your comprehensive business analysis. We'll keep you updated on progress and may request additional information.
                </p>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              <p><strong>Timeline:</strong> 2-3 weeks for complete analysis</p>
              <p><strong>Deliverable:</strong> 70+ page comprehensive knowledge base</p>
              <p><strong>Contact:</strong> Use the communication panel above for any questions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

