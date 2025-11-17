import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, Mail, User, Briefcase } from "lucide-react";

const PERMISSION_TEMPLATES = {
  locked_down: {
    name: "Locked Down",
    description: "Clients can only chat with agents. No configuration access.",
    permissions: {
      can_create_agents: false,
      can_edit_agents: false,
      can_delete_agents: false,
      can_upload_documents: false,
      can_edit_company_knowledge: false,
      can_contribute_to_playbooks: true,
      can_view_analytics: true,
      can_invite_team_members: false,
    }
  },
  moderate: {
    name: "Moderate",
    description: "Clients can upload documents and contribute to playbooks.",
    permissions: {
      can_create_agents: false,
      can_edit_agents: false,
      can_delete_agents: false,
      can_upload_documents: true,
      can_edit_company_knowledge: false,
      can_contribute_to_playbooks: true,
      can_view_analytics: true,
      can_invite_team_members: true,
    }
  },
  flexible: {
    name: "Flexible",
    description: "Clients have full access to manage their workspace.",
    permissions: {
      can_create_agents: true,
      can_edit_agents: true,
      can_delete_agents: true,
      can_upload_documents: true,
      can_edit_company_knowledge: true,
      can_contribute_to_playbooks: true,
      can_view_analytics: true,
      can_invite_team_members: true,
    }
  }
};

export default function CreateWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    company_domain: "",
    industry: "",
    primary_contact_email: "",
    primary_contact_first_name: "",
    primary_contact_last_name: "",
    permission_template: "moderate",
    custom_permissions: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.company_name || !formData.industry || !formData.primary_contact_email ||
        !formData.primary_contact_first_name || !formData.primary_contact_last_name) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields marked with *",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get the permissions for the selected template
      const selectedTemplate = PERMISSION_TEMPLATES[formData.permission_template as keyof typeof PERMISSION_TEMPLATES];
      const permissions = formData.custom_permissions
        ? JSON.parse(formData.custom_permissions)
        : selectedTemplate.permissions;

      // Call the create_client_workspace SQL function
      const { data, error } = await supabase.rpc('create_client_workspace', {
        p_consultant_id: user?.id,
        p_company_name: formData.company_name,
        p_company_domain: formData.company_domain || null,
        p_industry: formData.industry,
        p_primary_contact_email: formData.primary_contact_email,
        p_primary_contact_first_name: formData.primary_contact_first_name,
        p_primary_contact_last_name: formData.primary_contact_last_name,
        p_client_permissions: permissions,
      });

      if (error) throw error;

      toast({
        title: "Workspace created successfully!",
        description: `Invitation sent to ${formData.primary_contact_email}`,
      });

      // Redirect to the new workspace
      if (data && data.length > 0) {
        const companyId = data[0].company_id;
        navigate(`/consultant-portal/workspaces/${companyId}/company-os`);
      } else {
        navigate('/consultant-portal');
      }
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast({
        title: "Error creating workspace",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
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
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Create New Workspace
          </h1>
          <p className="text-muted-foreground">
            Set up a new client workspace and send an invitation
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic information about the client company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company_name">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    placeholder="Acme Corporation"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="company_domain">
                  Company Domain (optional)
                </Label>
                <Input
                  id="company_domain"
                  value={formData.company_domain}
                  onChange={(e) => handleChange('company_domain', e.target.value)}
                  placeholder="acme.com"
                />
              </div>

              <div>
                <Label htmlFor="industry">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => handleChange('industry', e.target.value)}
                    placeholder="Technology, Healthcare, Finance, etc."
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
              <CardDescription>
                This person will receive an invitation to access the workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_contact_first_name">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="primary_contact_first_name"
                      value={formData.primary_contact_first_name}
                      onChange={(e) => handleChange('primary_contact_first_name', e.target.value)}
                      placeholder="John"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="primary_contact_last_name">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="primary_contact_last_name"
                    value={formData.primary_contact_last_name}
                    onChange={(e) => handleChange('primary_contact_last_name', e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="primary_contact_email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="primary_contact_email"
                    type="email"
                    value={formData.primary_contact_email}
                    onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                    placeholder="john.doe@acme.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                Choose what the client can do in their workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="permission_template">
                  Permission Template
                </Label>
                <Select
                  value={formData.permission_template}
                  onValueChange={(value) => handleChange('permission_template', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <div className="font-semibold">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="custom_permissions">
                  Custom Permissions (JSON, optional)
                </Label>
                <Textarea
                  id="custom_permissions"
                  value={formData.custom_permissions}
                  onChange={(e) => handleChange('custom_permissions', e.target.value)}
                  placeholder='{"can_create_agents": false, "can_upload_documents": true, ...}'
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to use the selected template. Advanced users can provide custom JSON.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="mt-6 flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/consultant-portal')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Workspace & Send Invitation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
