import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Users, FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkspaceData {
  id: string;
  company_name: string;
  industry: string | null;
  workspace_type: string | null;
  created_at: string;
  agent_count: number;
  document_count: number;
  workspace_ready: boolean;
  has_company_os: boolean;
}

export default function ConsultantDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
    }
  }, [user]);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);

      // Fetch all client workspaces managed by this consultant
      const { data, error } = await supabase
        .from('consultant_workspaces')
        .select(`
          id,
          company_id,
          companies!inner (
            id,
            name,
            industry,
            workspace_type,
            created_at
          )
        `)
        .eq('consultant_id', user?.id);

      if (error) throw error;

      // For each workspace, fetch additional stats
      const workspacesWithStats = await Promise.all(
        (data || []).map(async (workspace: any) => {
          const companyId = workspace.company_id;

          // Count active agents
          const { count: agentCount } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'active');

          // Count agent documents
          const { count: documentCount } = await supabase
            .from('agent_documents')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId);

          // Check if CompanyOS exists
          const { data: companyOSData } = await supabase
            .from('company_os')
            .select('id')
            .eq('company_id', companyId)
            .single();

          // Check workspace ready status
          const { data: onboardingData } = await supabase
            .from('onboarding_sessions')
            .select('workspace_ready')
            .eq('company_id', companyId)
            .single();

          return {
            id: workspace.companies.id,
            company_name: workspace.companies.name,
            industry: workspace.companies.industry,
            workspace_type: workspace.companies.workspace_type,
            created_at: workspace.companies.created_at,
            agent_count: agentCount || 0,
            document_count: documentCount || 0,
            workspace_ready: onboardingData?.workspace_ready || false,
            has_company_os: !!companyOSData,
          };
        })
      );

      setWorkspaces(workspacesWithStats);
    } catch (error: any) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: "Error loading workspaces",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workspace.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (workspace: WorkspaceData) => {
    if (workspace.workspace_ready) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    } else if (workspace.has_company_os) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          <Clock className="w-3 h-3 mr-1" />
          Pending Setup
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Incomplete
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Consultant Portal
            </h1>
            <p className="text-muted-foreground">
              Manage your client workspaces and deployments
            </p>
          </div>
          <Button
            onClick={() => navigate('/consultant-portal/workspaces/new')}
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Workspace
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{workspaces.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ready
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {workspaces.filter(w => w.workspace_ready).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {workspaces.reduce((sum, w) => sum + w.agent_count, 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {workspaces.reduce((sum, w) => sum + w.document_count, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Search workspaces by name or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Workspaces Grid */}
        {filteredWorkspaces.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No workspaces found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search" : "Get started by creating your first client workspace"}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate('/consultant-portal/workspaces/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkspaces.map((workspace) => (
              <Card
                key={workspace.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/consultant-portal/workspaces/${workspace.id}/agents`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">
                        {workspace.company_name}
                      </CardTitle>
                      <CardDescription>
                        {workspace.industry || 'No industry specified'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(workspace)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        Agents
                      </span>
                      <span className="font-semibold">{workspace.agent_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <FileText className="w-4 h-4 mr-2" />
                        Documents
                      </span>
                      <span className="font-semibold">{workspace.document_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        CompanyOS
                      </span>
                      <span className="font-semibold">
                        {workspace.has_company_os ? 'Complete' : 'Missing'}
                      </span>
                    </div>
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(workspace.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
