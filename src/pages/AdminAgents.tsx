import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { AgentManager } from "@/components/admin/AgentManager";

function AdminAgentsContent() {
  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Agent Management</h1>
        <p className="text-muted-foreground">Create, manage, and monitor your AI agents and their OpenAI assistants</p>
      </div>
      <AgentManager />
    </div>
  );
}

export default function AdminAgents() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Agents</h2>
            </header>
            <AdminAgentsContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}