import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, FileText } from "lucide-react";

export default function WorkspacePlaybooks() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<any>(null);
  const [playbooks, setPlaybooks] = useState<any[]>([]);

  useEffect(() => {
    if (workspaceId) {
      fetchCompanyData();
      fetchPlaybooks();
    }
  }, [workspaceId]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setCompanyData(data);
    } catch (error: any) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchPlaybooks = async () => {
    try {
      const { data, error } = await supabase
        .from('playbook_documents')
        .select('*')
        .eq('company_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaybooks(data || []);
    } catch (error: any) {
      console.error('Error fetching playbooks:', error);
    } finally {
      setLoading(false);
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
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/consultant-portal')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Playbooks: {companyData?.name}
              </h1>
              <p className="text-muted-foreground">
                Manage process documentation and guidelines
              </p>
            </div>
            <Button onClick={() => navigate('/playbook')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Playbook
            </Button>
          </div>
        </div>

        {/* Playbooks List */}
        {playbooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No playbooks yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first playbook for this workspace
              </p>
              <Button onClick={() => navigate('/playbook')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Playbook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playbooks.map((playbook) => (
              <Card key={playbook.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{playbook.title}</CardTitle>
                  <CardDescription>
                    {playbook.section || 'General'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Status: {playbook.status || 'draft'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {new Date(playbook.updated_at).toLocaleDateString()}
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
