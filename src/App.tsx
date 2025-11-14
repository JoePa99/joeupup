import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CompanyAdminProtectedRoute } from "@/components/auth/CompanyAdminProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import Playbook from "./pages/Playbook";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import CompanyAgents from "./pages/CompanyAgents";
import AdminAgents from "./pages/AdminAgents";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminCompanies from "./pages/AdminCompanies";
import AdminDocuments from "./pages/AdminDocuments";
import AdminConsultations from "./pages/AdminConsultations";
import CompanyConsultations from "./pages/CompanyConsultations";
import ClientDashboard from "./pages/ClientDashboard";
import ClientDashboardLayout from "./pages/ClientDashboardLayout";
import ClientDetail from "./pages/ClientDetail";
import Documents from "./pages/Documents";
import AdminDiagnostic from "./pages/AdminDiagnostic";
import AdminSupabaseHealth from "./pages/AdminSupabaseHealth";
import GoogleOAuth from "./pages/GoogleOAuth";
import GoogleOAuthCallback from "./pages/GoogleOAuthCallback";
import HubSpotOAuth from "./pages/HubSpotOAuth";
import HubSpotOAuthCallback from "./pages/HubSpotOAuthCallback";
import ShopifyOAuth from "./pages/ShopifyOAuth";
import ShopifyOAuthCallback from "./pages/ShopifyOAuthCallback";
import QuickBooksOAuth from "./pages/QuickBooksOAuth";
import QuickBooksOAuthCallback from "./pages/QuickBooksOAuthCallback";
import Integrations from "./pages/Integrations";
import InviteTeamMembers from "./pages/InviteTeamMembers";
import AcceptInvitation from "./pages/AcceptInvitation";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Usage from "./pages/Usage";
import Billing from "./pages/Billing";
import AdminUsageManagement from "./pages/AdminUsageManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute requireOnboarding>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/playbook" 
              element={
                <ProtectedRoute requireOnboarding>
                  <Playbook />
                </ProtectedRoute>
              } 
            />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/agents" element={<AdminAgents />} />
            <Route path="/dashboard/consultations" element={<AdminConsultations />} />
            <Route path="/dashboard/users" element={<AdminUsers />} />
            <Route path="/dashboard/users/:userId" element={<AdminUserDetail />} />
            <Route path="/dashboard/companies" element={<AdminCompanies />} />
            <Route path="/dashboard/documents" element={<AdminDocuments />} />
            <Route path="/dashboard/supabase-health" element={<AdminSupabaseHealth />} />
            <Route path="/client/:clientId" element={<ClientDetail />} />
            <Route 
              path="/admin-diagnostic" 
              element={
                <ProtectedRoute>
                  <AdminDiagnostic />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/client-dashboard" 
              element={
                <ProtectedRoute requireOnboarding>
                  <ClientDashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClientDashboard />} />
              <Route path="usage" element={<Usage />} />
            </Route>
            <Route 
              path="/agents" 
              element={
                <ProtectedRoute requireOnboarding>
                  <Agents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/company-agents" 
              element={
                <ProtectedRoute requireOnboarding>
                  <CompanyAgents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/documents" 
              element={
                <ProtectedRoute requireOnboarding>
                  <Documents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/google-oauth" 
              element={
                <ProtectedRoute>
                  <GoogleOAuth />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/google-oauth-callback" 
              element={<GoogleOAuthCallback />} 
            />
            <Route 
              path="/hubspot-oauth" 
              element={
                <ProtectedRoute>
                  <HubSpotOAuth />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hubspot-oauth-callback" 
              element={<HubSpotOAuthCallback />} 
            />
            <Route 
              path="/shopify-oauth" 
              element={
                <ProtectedRoute>
                  <ShopifyOAuth />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/shopify-oauth-callback" 
              element={<ShopifyOAuthCallback />} 
            />
            <Route 
              path="/quickbooks-oauth" 
              element={
                <ProtectedRoute>
                  <QuickBooksOAuth />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/quickbooks-oauth-callback" 
              element={<QuickBooksOAuthCallback />} 
            />
            <Route 
              path="/integrations" 
              element={
                <ProtectedRoute>
                  <Integrations />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/welcome" 
              element={
                <ProtectedRoute requireOnboarding>
                  <Welcome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/invite-team" 
              element={
                <ProtectedRoute requireOnboarding>
                  <InviteTeamMembers />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/consultations" 
              element={
                <CompanyAdminProtectedRoute>
                  <CompanyConsultations />
                </CompanyAdminProtectedRoute>
              } 
            />
            {/* Usage route moved to /client-dashboard/usage */}
            <Route 
              path="/billing" 
              element={
                <CompanyAdminProtectedRoute>
                  <Billing />
                </CompanyAdminProtectedRoute>
              } 
            />
            <Route 
              path="/team-usage" 
              element={
                <CompanyAdminProtectedRoute>
                  <AdminUsageManagement />
                </CompanyAdminProtectedRoute>
              } 
            />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
