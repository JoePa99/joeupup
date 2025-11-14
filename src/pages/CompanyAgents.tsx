import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { CompanyAgentsContent } from "@/components/admin/CompanyAgentsContent";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CompanyAgents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: platformAdminData, isLoading: adminCheckLoading } = usePlatformAdmin();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user?.id]);

  // Extract company ID from URL search params or use profile's company
  const searchParams = new URLSearchParams(window.location.search);
  const urlCompanyId = searchParams.get("company");
  const effectiveCompanyId = urlCompanyId || profile?.company_id;

  // Determine if user has access
  const isPlatformAdmin = platformAdminData?.success && platformAdminData?.isAdmin;
  const isCompanyAdmin = profile?.role === "admin" && profile?.company_id === effectiveCompanyId;
  const hasAccess = isPlatformAdmin || isCompanyAdmin;

  if (loading || adminCheckLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            You don't have permission to manage company agents.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (!effectiveCompanyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">No Company Found</h2>
          <p className="text-muted-foreground mb-6">
            Unable to determine the company for agent management.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-14 md:h-12 flex items-center border-b border-border px-4 sm:px-6">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <h1 className="text-lg font-semibold">Company Agents</h1>
          </header>
          
          {/* Main content area */}
          <div className="flex-1 p-4 sm:p-6">
            <CompanyAgentsContent companyId={effectiveCompanyId} />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
