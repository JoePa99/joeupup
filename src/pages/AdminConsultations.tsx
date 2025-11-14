import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { ConsultationManager } from "@/components/admin/ConsultationManager";

function AdminConsultationsContent() {
  return (
    <ConsultationManager hideHeader={true} />
  );
}

export default function AdminConsultations() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Consultations</h2>
            </header>
            <AdminConsultationsContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

