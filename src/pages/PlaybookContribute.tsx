import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PlaybookContribute() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    section: "",
    content: "",
    tags: "",
  });

  useEffect(() => {
    if (profile?.company_id) {
      fetchPlaybooks();
    }
  }, [profile]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('playbook_documents')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setPlaybooks(data || []);
    } catch (error: any) {
      console.error('Error fetching playbooks:', error);
      toast({
        title: "Error loading playbooks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.content) {
      toast({
        title: "Missing required fields",
        description: "Please provide at least a title and content",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('playbook_documents').insert({
        company_id: profile?.company_id,
        title: formData.title,
        section: formData.section || 'General',
        content: formData.content,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: 'draft',
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: "Playbook section created!",
        description: "Your contribution has been saved",
      });

      // Reset form and refresh playbooks
      setFormData({ title: "", section: "", content: "", tags: "" });
      setShowNewForm(false);
      fetchPlaybooks();
    } catch (error: any) {
      toast({
        title: "Error saving playbook",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case 'complete':
        return <Badge className="bg-green-500">Published</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/client-dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Playbook Contributions
              </h1>
              <p className="text-muted-foreground">
                Share your knowledge and contribute to team playbooks
              </p>
            </div>
            {!showNewForm && (
              <Button onClick={() => setShowNewForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Contribution
              </Button>
            )}
          </div>
        </div>

        {/* New Contribution Form */}
        {showNewForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Playbook Section</CardTitle>
              <CardDescription>
                Add a new section to the team playbook
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., How to handle customer objections"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="section">Section</Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g., Sales, Support, Onboarding"
                  />
                </div>

                <div>
                  <Label htmlFor="content">
                    Content <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Write your playbook content here... (Markdown supported)"
                    rows={12}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports Markdown formatting
                  </p>
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="sales, objections, best-practices"
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewForm(false);
                      setFormData({ title: "", section: "", content: "", tags: "" });
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Contribution
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Existing Playbooks */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Playbooks</CardTitle>
            <CardDescription>
              View and manage your contributions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {playbooks.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No playbooks yet</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to contribute to the team playbook
                </p>
                {!showNewForm && (
                  <Button onClick={() => setShowNewForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Playbook
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {playbooks.map((playbook) => (
                  <div
                    key={playbook.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{playbook.title}</h3>
                        {getStatusBadge(playbook.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{playbook.section || 'General'}</span>
                        <span>•</span>
                        <span>Updated {new Date(playbook.updated_at).toLocaleDateString()}</span>
                      </div>
                      {playbook.tags && playbook.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {playbook.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
