import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { ClientSidebar } from '@/components/ui/client-sidebar';
import { PlatformAdminProtectedRoute } from '@/components/auth/PlatformAdminProtectedRoute';
import { useClientDetails } from '@/hooks/useClientDetails';
import { useCompanyDocuments, useDownloadDocument, useDeleteDocument, formatFileSize } from '@/hooks/useDocumentManagement';
import { DocumentPreviewModal } from '@/components/documents/DocumentPreviewModal';
import { EditDocumentModal } from '@/components/documents/EditDocumentModal';
import { DocumentUploadArea } from '@/components/documents/DocumentUploadArea';
import { DocumentManagementContent } from '@/components/documents/DocumentManagementContent';
import { PlaybookManager } from '@/components/admin/PlaybookManager';
import { CompanyAgentsContent } from '@/components/admin/CompanyAgentsContent';
import { CompanyOSViewer } from '@/components/company-os/CompanyOSViewer';
import { useCompanyOS } from '@/hooks/useCompanyOS';
import { useToast } from '@/hooks/use-toast';
import type { DocumentWithDetails } from '@/hooks/useDocumentManagement';
import {
  Building2,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  Globe,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  User,
  Mail,
  Upload,
  Eye,
  Download,
  Edit,
  Trash2,
  Play,
  BookOpen,
  Hash,
  UserCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ClientDetailContent() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: client, isLoading, error } = useClientDetails(clientId || '');
  const { data: documents, refetch: refetchDocuments } = useCompanyDocuments(clientId);
  const { data: companyOS, isLoading: loadingCompanyOS } = useCompanyOS(clientId);
  const downloadMutation = useDownloadDocument();
  const deleteMutation = useDeleteDocument();

  // State for document modals
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithDetails | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Get current section from hash
  const [currentSection, setCurrentSection] = useState('overview');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentSection(hash || 'overview');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!clientId) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Invalid Client ID</h2>
          <p className="text-muted-foreground mb-4">Please provide a valid client ID.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Loading Client Details</h2>
          <p className="text-muted-foreground">Fetching comprehensive client information...</p>
        </Card>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Client Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Unable to load client details'}
          </p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const getConsultationStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'requested': return 'outline';
      default: return 'outline';
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'default';
      case 'professional': return 'secondary';
      default: return 'outline';
    }
  };

  const handlePreview = (doc: DocumentWithDetails) => {
    setSelectedDocument(doc);
    setPreviewOpen(true);
  };

  const handleEdit = (doc: DocumentWithDetails) => {
    setSelectedDocument(doc);
    setEditOpen(true);
  };

  const handleDownload = async (doc: DocumentWithDetails) => {
    try {
      await downloadMutation.mutateAsync(doc);
      toast({
        title: "Download started",
        description: `Downloading ${doc.file_name}`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (doc: DocumentWithDetails) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(doc.id);
      toast({
        title: "Document deleted",
        description: `${doc.name} has been deleted successfully`,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <Users className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.total_users}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.total_users}</p>
            <p className="text-sm text-muted-foreground">Team Members</p>
            <p className="text-xs text-muted-foreground mt-1">{client.active_users_count} active</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.total_documents}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.total_documents}</p>
            <p className="text-sm text-muted-foreground">Documents</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <Hash className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.total_channels}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.total_channels}</p>
            <p className="text-sm text-muted-foreground">Channels</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.total_messages}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.total_messages}</p>
            <p className="text-sm text-muted-foreground">Messages</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.onboarding_completion}%</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.onboarding_completion}%</p>
            <p className="text-sm text-muted-foreground">Onboarding</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{client.playbook_completion}%</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{client.playbook_completion}%</p>
            <p className="text-sm text-muted-foreground">Playbook</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Information */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>Basic company details and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Name:</span>
                <span>{client.name}</span>
              </div>
              {client.domain && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Domain:</span>
                  <span>{client.domain}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Created:</span>
                <span>{new Date(client.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Last Activity:</span>
                <span>{client.last_activity}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common management tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => window.location.hash = 'onboarding'}
            >
              <Play className="h-4 w-4 mr-2" />
              View Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Timeline */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest client interactions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {client.consultation_requests.slice(0, 3).map((consultation) => (
              <div key={consultation.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-subtle">
                <MessageSquare className="h-4 w-4 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Consultation Request - {consultation.contact_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(consultation.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={getConsultationStatusColor(consultation.status)}>
                  {consultation.status}
                </Badge>
              </div>
            ))}
            {documents?.slice(0, 2).map((document) => (
              <div key={document.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-subtle">
                <FileText className="h-4 w-4 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Document Uploaded - {document.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(document.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{document.doc_type}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsers = () => (
    <Card className="border border-gray-200 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members ({client.profiles.length})
        </CardTitle>
        <CardDescription>All users associated with this client</CardDescription>
      </CardHeader>
      <CardContent>
        {client.profiles.length > 0 ? (
          <div className="space-y-4">
            {client.profiles.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {profile.first_name && profile.last_name
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile.email}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {profile.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role}
                  </Badge>
                  {profile.last_login_at && (
                    <span className="text-xs text-muted-foreground">
                      Last login: {new Date(profile.last_login_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Users Found</h3>
            <p className="text-muted-foreground">This client has no associated users yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Documents</h2>
          <p className="text-muted-foreground">
            {documents?.length || 0} documents uploaded
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-6">
          {documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{document.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="truncate">{document.file_name}</span>
                        <span>•</span>
                        <span>{formatFileSize(document.file_size)}</span>
                        <span>•</span>
                        <span>{new Date(document.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <Badge variant="outline">{document.doc_type}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(document)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(document)}
                      disabled={downloadMutation.isPending}
                      title="Download"
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(document)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(document)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Documents Found</h3>
              <p className="text-muted-foreground mb-4">This client has not uploaded any documents yet.</p>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderConsultations = () => (
    <div className="space-y-6">
      {client.consultation_requests.length > 0 ? (
        client.consultation_requests.map((consultation) => (
          <Card key={consultation.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Consultation Request
                </CardTitle>
                <Badge variant={getConsultationStatusColor(consultation.status)}>
                  {consultation.status}
                </Badge>
              </div>
              <CardDescription>
                Submitted {new Date(consultation.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div>
                <h4 className="font-semibold mb-3">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Contact Name</span>
                    <p className="font-medium">{consultation.contact_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p className="font-medium">{consultation.contact_email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <p className="font-medium">{consultation.contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h4 className="font-semibold mb-3">Business Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Industry</span>
                    <p className="font-medium">{consultation.industry || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Company Size</span>
                    <p className="font-medium">{consultation.company_size || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Annual Revenue</span>
                    <p className="font-medium">{consultation.annual_revenue || 'Not disclosed'}</p>
                  </div>
                </div>
                
                {consultation.business_background && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Business Background</span>
                    <p className="text-sm bg-surface-subtle p-3 rounded-lg">{consultation.business_background}</p>
                  </div>
                )}
              </div>

              {/* Goals and Challenges */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {consultation.goals_objectives && (
                  <div>
                    <span className="text-sm text-muted-foreground">Goals & Objectives</span>
                    <p className="text-sm bg-surface-subtle p-3 rounded-lg mt-2">{consultation.goals_objectives}</p>
                  </div>
                )}
                
                {consultation.current_challenges && (
                  <div>
                    <span className="text-sm text-muted-foreground">Current Challenges</span>
                    <p className="text-sm bg-surface-subtle p-3 rounded-lg mt-2">{consultation.current_challenges}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Consultation Requests</h3>
            <p className="text-muted-foreground">This client has not requested any consultations yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderOnboarding = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Onboarding Progress ({client.onboarding_completion}%)
        </CardTitle>
        <CardDescription>Client onboarding sessions and completion status</CardDescription>
      </CardHeader>
      <CardContent>
        {client.onboarding_sessions.length > 0 ? (
          <div className="space-y-4">
            {client.onboarding_sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${
                    session.status === 'completed' ? 'bg-green-500' :
                    session.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-300'
                  }`} />
                  <div>
                    <div className="font-medium">Onboarding Session</div>
                    <div className="text-sm text-muted-foreground">
                      {session.onboarding_type || 'Standard Onboarding'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    session.status === 'completed' ? 'default' :
                    session.status === 'in_progress' ? 'secondary' : 'outline'
                  }>
                    {session.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Onboarding Sessions</h3>
            <p className="text-muted-foreground">This client has not started onboarding yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderChannels = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Channels ({client.channels.length})
        </CardTitle>
        <CardDescription>All communication channels for this company</CardDescription>
      </CardHeader>
      <CardContent>
        {client.channels.length > 0 ? (
          <div className="space-y-4">
            {client.channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <Hash className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{channel.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {channel.description || 'No description'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {channel.is_private && <Badge variant="secondary">Private</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {new Date(channel.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Hash className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Channels Found</h3>
            <p className="text-muted-foreground">This company has not created any channels yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderMessages = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Message Statistics
        </CardTitle>
        <CardDescription>Company-wide messaging activity and insights</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-subtle">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <Badge variant="secondary">Total</Badge>
              </div>
              <p className="text-2xl font-bold">{client.total_messages}</p>
              <p className="text-sm text-muted-foreground">Total Messages</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-subtle">
              <div className="flex items-center justify-between mb-2">
                <Hash className="h-5 w-5 text-primary" />
                <Badge variant="secondary">{client.total_channels}</Badge>
              </div>
              <p className="text-2xl font-bold">{client.total_channels}</p>
              <p className="text-sm text-muted-foreground">Active Channels</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-subtle">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-primary" />
                <Badge variant="secondary">{client.active_users_count}</Badge>
              </div>
              <p className="text-2xl font-bold">{client.active_users_count}</p>
              <p className="text-sm text-muted-foreground">Active Users (7d)</p>
            </div>
          </div>

          {/* Average per user */}
          <div className="p-4 rounded-lg border border-border">
            <h4 className="font-semibold mb-3">Engagement Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Avg Messages per User</span>
                <p className="text-xl font-bold">
                  {client.total_users > 0 
                    ? Math.round((client.total_messages / client.total_users) * 10) / 10
                    : 0
                  }
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Active User Rate</span>
                <p className="text-xl font-bold">
                  {client.total_users > 0 
                    ? Math.round((client.active_users_count / client.total_users) * 100)
                    : 0
                  }%
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPlaybook = () => (
    <div className="space-y-6">
      <Tabs defaultValue="documents" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
          <TabsTrigger 
            value="documents" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Playbook Documents</span>
            <span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger 
            value="companyos" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">CompanyOS</span>
            <span className="sm:hidden">OS</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-6">
          <PlaybookManager 
            companyId={clientId}
            onBack={() => window.location.hash = 'overview'}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentManagementContent companyId={clientId} />
        </TabsContent>

        <TabsContent value="companyos" className="space-y-6">
          {loadingCompanyOS ? (
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Loading CompanyOS...</p>
              </CardContent>
            </Card>
          ) : companyOS ? (
            <CompanyOSViewer companyOS={companyOS} />
          ) : (
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No CompanyOS Found</h3>
                <p className="text-muted-foreground">
                  This company does not have a CompanyOS generated yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderCompanyAgents = () => (
    <CompanyAgentsContent companyId={clientId} />
  );

  const renderSection = () => {
    switch (currentSection) {
      case 'users':
        return renderUsers();
      case 'documents':
        return renderDocuments();
      case 'channels':
        return renderChannels();
      case 'messages':
        return renderMessages();
      case 'consultations':
        return renderConsultations();
      case 'onboarding':
        return renderOnboarding();
      case 'playbook':
        return renderPlaybook();
      case 'agents':
        return renderCompanyAgents();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 p-6 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground mt-1">Complete client overview and management</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPlanBadgeVariant(client.plan)}>
              {client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}
            </Badge>
            {client.consultation_status !== 'none' && (
              <Badge variant={getConsultationStatusColor(client.consultation_status)}>
                Consultation: {client.consultation_status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>

        {/* Section Content */}
        {renderSection()}
      </div>

      {/* Modals */}
      {uploadOpen && (
        <DocumentUploadArea
          companyId={clientId}
          onUploadComplete={() => {
            refetchDocuments();
            setUploadOpen(false);
          }}
          onClose={() => setUploadOpen(false)}
        />
      )}
      {selectedDocument && (
        <>
          <DocumentPreviewModal
            document={{
              id: selectedDocument.id,
              name: selectedDocument.name,
              file_name: selectedDocument.file_name,
              file_type: selectedDocument.file_type,
              file_size: selectedDocument.file_size,
              storage_path: selectedDocument.storage_path,
              created_at: selectedDocument.created_at,
              uploaded_by: selectedDocument.uploaded_by,
              doc_type: selectedDocument.doc_type,
              description: selectedDocument.description
            }}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
          />
          <EditDocumentModal
            document={{
              id: selectedDocument.id,
              name: selectedDocument.name,
              file_name: selectedDocument.file_name,
              file_type: selectedDocument.file_type,
              file_size: selectedDocument.file_size,
              created_at: selectedDocument.created_at,
              uploaded_by: selectedDocument.uploaded_by,
              doc_type: selectedDocument.doc_type,
              description: selectedDocument.description,
              tags: selectedDocument.tags
            }}
            open={editOpen}
            onOpenChange={setEditOpen}
            onDocumentUpdated={refetchDocuments}
          />
        </>
      )}
    </>
  );
}

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: client } = useClientDetails(clientId || '');

  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <ClientSidebar
            clientId={clientId || ''}
            clientName={client?.name || 'Loading...'}
            onBack={() => navigate('/dashboard')}
          />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Client Details</h2>
            </header>
            <ClientDetailContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}
