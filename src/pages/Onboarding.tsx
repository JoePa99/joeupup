import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkspaceFormState {
  workspaceName: string;
  website: string;
  firstName: string;
  lastName: string;
}

export default function Onboarding() {
  const { user, signOut, isOnboardingComplete } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<WorkspaceFormState>({
    workspaceName: "",
    website: "",
    firstName: "",
    lastName: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasExistingWorkspace, setHasExistingWorkspace] = useState(false);

  useEffect(() => {
    if (isOnboardingComplete) {
      navigate("/client-dashboard", { replace: true });
    }
  }, [isOnboardingComplete, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!user) return;

      setIsLoadingProfile(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, company_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading profile for onboarding:', error);
          toast.error('Unable to load your profile. Please try again.');
          return;
        }

        if (!isMounted) return;

        if (profile) {
          setFormData(prev => ({
            ...prev,
            firstName: profile.first_name || "",
            lastName: profile.last_name || "",
          }));

          if (profile.company_id) {
            setHasExistingWorkspace(true);
            const { data: company, error: companyError } = await supabase
              .from('companies')
              .select('name, domain')
              .eq('id', profile.company_id)
              .maybeSingle();

            if (!isMounted) return;

            if (companyError) {
              console.error('Error loading company data:', companyError);
            } else if (company) {
              setFormData(prev => ({
                ...prev,
                workspaceName: company.name || prev.workspaceName,
                website: company.domain || prev.website,
              }));
            }
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const updateForm = (field: keyof WorkspaceFormState, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.workspaceName.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        workspaceName: formData.workspaceName.trim(),
        companyWebsite: formData.website.trim() || null,
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
      };

      const { error } = await supabase.functions.invoke('create-workspace', {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || 'Failed to create workspace');
      }

      toast.success('Workspace is ready! Redirecting you to the dashboard.');
      navigate('/client-dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create workspace';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const isBusy = isSubmitting || isLoadingProfile;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold">
              V
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Workspace Setup</p>
              <h1 className="text-xl font-semibold">Create your admin workspace</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-5 w-5 text-primary" />
              Platform admin workspace
            </CardTitle>
            <CardDescription>
              {hasExistingWorkspace
                ? 'Update your workspace details so we can finish provisioning your environment.'
                : 'Tell us a few things about your workspace so we can get everything ready instantly.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace or company name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="workspaceName"
                    className="pl-10"
                    placeholder="Acme AI"
                    value={formData.workspaceName}
                    onChange={(event) => updateForm('workspaceName', event.target.value)}
                    disabled={isBusy}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(event) => updateForm('website', event.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder="Jane"
                    value={formData.firstName}
                    onChange={(event) => updateForm('firstName', event.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(event) => updateForm('lastName', event.target.value)}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What happens next</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>We create a secure workspace that you administrate.</li>
                  <li>Your profile is elevated to a platform admin so you can invite others.</li>
                  <li>You'll immediately land in the workspace shell to continue setup.</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={isBusy}>
                {isBusy ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Create workspace'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
