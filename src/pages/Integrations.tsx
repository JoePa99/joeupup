import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, TrashIcon, EnvelopeIcon, DocumentTextIcon, TableCellsIcon, CalendarIcon, CircleStackIcon, UsersIcon, BuildingOffice2Icon, CurrencyDollarIcon, TicketIcon, CubeIcon, ShoppingCartIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { HubSpotOAuthButton } from "@/components/auth/HubSpotOAuthButton";
import { QuickBooksOAuthButton } from "@/components/auth/QuickBooksOAuthButton";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";

interface GoogleIntegration {
  id: string;
  is_active: boolean;
  gmail_enabled: boolean;
  drive_enabled: boolean;
  docs_enabled: boolean;
  sheets_enabled: boolean;
  calendar_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface HubSpotIntegration {
  id: string;
  is_active: boolean;
  contacts_enabled: boolean;
  companies_enabled: boolean;
  deals_enabled: boolean;
  tickets_enabled: boolean;
  workflows_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface QuickBooksIntegration {
  id: string;
  is_active: boolean;
  customers_enabled: boolean;
  invoices_enabled: boolean;
  payments_enabled: boolean;
  items_enabled: boolean;
  accounts_enabled: boolean;
  created_at: string;
  updated_at: string;
}


export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [googleIntegration, setGoogleIntegration] = useState<GoogleIntegration | null>(null);
  const [hubspotIntegration, setHubspotIntegration] = useState<HubSpotIntegration | null>(null);
  const [quickbooksIntegration, setQuickbooksIntegration] = useState<QuickBooksIntegration | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState({ google: false, hubspot: false, quickbooks: false });

  useEffect(() => {
    if (user) {
      fetchGoogleIntegration();
      fetchHubSpotIntegration();
      fetchQuickBooksIntegration();
      setLoading(false);
    }
  }, [user]);

  const fetchGoogleIntegration = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setGoogleIntegration(data);
    } catch (error) {
      console.error('Error fetching Google integration:', error);
    }
  };

  const fetchHubSpotIntegration = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('hubspot_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setHubspotIntegration(data);
    } catch (error) {
      console.error('Error fetching HubSpot integration:', error);
    }
  };

  const fetchQuickBooksIntegration = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('quickbooks_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setQuickbooksIntegration(data);
    } catch (error) {
      console.error('Error fetching QuickBooks integration:', error);
    }
  };


  const handleDisconnectGoogle = async () => {
    if (!googleIntegration) return;

    setIsDisconnecting(prev => ({ ...prev, google: true }));
    try {
      const { error } = await supabase
        .from('google_integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', googleIntegration.id);

      if (error) throw error;

      setGoogleIntegration(null);
      toast({
        title: "Integration disconnected",
        description: "Google Workspace has been disconnected successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Disconnection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(prev => ({ ...prev, google: false }));
    }
  };

  const handleDisconnectHubSpot = async () => {
    if (!hubspotIntegration) return;

    setIsDisconnecting(prev => ({ ...prev, hubspot: true }));
    try {
      const { error } = await (supabase as any)
        .from('hubspot_integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', hubspotIntegration.id);

      if (error) throw error;

      setHubspotIntegration(null);
      toast({
        title: "Integration disconnected",
        description: "HubSpot CRM has been disconnected successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Disconnection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(prev => ({ ...prev, hubspot: false }));
    }
  };

  const handleDisconnectQuickBooks = async () => {
    if (!quickbooksIntegration) return;

    setIsDisconnecting(prev => ({ ...prev, quickbooks: true }));
    try {
      const { error } = await (supabase as any)
        .from('quickbooks_integrations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', quickbooksIntegration.id);

      if (error) throw error;

      setQuickbooksIntegration(null);
      toast({
        title: "Integration disconnected",
        description: "QuickBooks has been disconnected successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Disconnection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(prev => ({ ...prev, quickbooks: false }));
    }
  };


  const handleGoogleConnectionSuccess = () => {
    fetchGoogleIntegration();
    toast({
      title: "Integration connected",
      description: "Google Workspace has been connected successfully.",
    });
  };

  const handleHubSpotConnectionSuccess = () => {
    fetchHubSpotIntegration();
    toast({
      title: "Integration connected",
      description: "HubSpot CRM has been connected successfully.",
    });
  };

  const handleQuickBooksConnectionSuccess = () => {
    fetchQuickBooksIntegration();
    toast({
      title: "Integration connected",
      description: "QuickBooks has been connected successfully.",
    });
  };


  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'gmail': return <EnvelopeIcon className="h-4 w-4" />;
      case 'drive': return <CircleStackIcon className="h-4 w-4" />;
      case 'docs': return <DocumentTextIcon className="h-4 w-4" />;
      case 'sheets': return <TableCellsIcon className="h-4 w-4" />;
      case 'calendar': return <CalendarIcon className="h-4 w-4" />;
      case 'contacts': return <UsersIcon className="h-4 w-4" />;
      case 'companies': return <BuildingOffice2Icon className="h-4 w-4" />;
      case 'deals': return <CurrencyDollarIcon className="h-4 w-4" />;
      case 'tickets': return <TicketIcon className="h-4 w-4" />;
      case 'customers': return <UsersIcon className="h-4 w-4" />;
      case 'invoices': return <DocumentTextIcon className="h-4 w-4" />;
      case 'payments': return <CurrencyDollarIcon className="h-4 w-4" />;
      case 'items': return <BuildingOffice2Icon className="h-4 w-4" />;
      case 'accounts': return <TableCellsIcon className="h-4 w-4" />;
      default: return <PuzzlePieceIcon className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const googleEnabledServices = googleIntegration ? [
    { name: 'Gmail', enabled: googleIntegration.gmail_enabled, key: 'gmail' },
    { name: 'Drive', enabled: googleIntegration.drive_enabled, key: 'drive' },
    { name: 'Docs', enabled: googleIntegration.docs_enabled, key: 'docs' },
    { name: 'Sheets', enabled: googleIntegration.sheets_enabled, key: 'sheets' },
    { name: 'Calendar', enabled: googleIntegration.calendar_enabled, key: 'calendar' },
  ].filter(service => service.enabled) : [];

  const hubspotEnabledServices = hubspotIntegration ? [
    { name: 'Contacts', enabled: hubspotIntegration.contacts_enabled, key: 'contacts' },
    { name: 'Companies', enabled: hubspotIntegration.companies_enabled, key: 'companies' },
    { name: 'Deals', enabled: hubspotIntegration.deals_enabled, key: 'deals' },
    { name: 'Tickets', enabled: hubspotIntegration.tickets_enabled, key: 'tickets' },
    { name: 'Workflows', enabled: hubspotIntegration.workflows_enabled, key: 'workflows' },
  ].filter(service => service.enabled) : [];

  const quickbooksEnabledServices = quickbooksIntegration ? [
    { name: 'Customers', enabled: quickbooksIntegration.customers_enabled, key: 'customers' },
    { name: 'Invoices', enabled: quickbooksIntegration.invoices_enabled, key: 'invoices' },
    { name: 'Payments', enabled: quickbooksIntegration.payments_enabled, key: 'payments' },
    { name: 'Items', enabled: quickbooksIntegration.items_enabled, key: 'items' },
    { name: 'Accounts', enabled: quickbooksIntegration.accounts_enabled, key: 'accounts' },
  ].filter(service => service.enabled) : [];


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-12 flex items-center border-b border-border px-4 bg-white">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold">Integrations</h1>
          </header>
          
          {/* Main content area */}
          <div className="flex-1 p-6 bg-white">
            <div className="w-full  mx-auto space-y-8">
              

              {/* Integrations Grid */}
              <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
                
                {/* Google Workspace Integration Card */}
                <Card className="relative overflow-hidden shadow-none border border-gray-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                        </div>
                        <div>
                          <CardTitle className="text-lg">Google Workspace</CardTitle>
                          <CardDescription className="text-sm">
                            Connect Gmail, Drive, Docs, Sheets, and Calendar
                          </CardDescription>
                        </div>
                      </div>
                      {googleIntegration ? (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <XCircleIcon className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {googleIntegration ? (
                      <>
                        {/* Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Connected on {formatDate(googleIntegration.created_at)}
                          </div>
                          
                          {/* Enabled Services */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Enabled Services:</div>
                            <div className="flex flex-wrap gap-2">
                              {googleEnabledServices.map(service => (
                                <Badge key={service.key} variant="outline" className="flex items-center space-x-1">
                                  {getServiceIcon(service.key)}
                                  <span>{service.name}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col space-y-2 pt-2">
                            <GoogleOAuthButton 
                              onSuccess={handleGoogleConnectionSuccess}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            />
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleDisconnectGoogle}
                              disabled={isDisconnecting.google}
                              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              {isDisconnecting.google ? 'Disconnecting...' : 'Disconnect'}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Not Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Enable AI agents to access your Google Workspace data for enhanced functionality.
                          </div>
                          
                          {/* Available Services */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Available Services:</div>
                            <div className="space-y-1 text-sm text-text-secondary">
                              <div className="flex items-center space-x-2">
                                <EnvelopeIcon className="h-3 w-3" />
                                <span>Gmail - Read and manage emails</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CircleStackIcon className="h-3 w-3" />
                                <span>Drive - Access files and folders</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <DocumentTextIcon className="h-3 w-3" />
                                <span>Docs - Read and edit documents</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <TableCellsIcon className="h-3 w-3" />
                                <span>Sheets - Access spreadsheet data</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="h-3 w-3" />
                                <span>Calendar - Manage events and schedules</span>
                              </div>
                            </div>
                          </div>

                          {/* Connect Button */}
                          <GoogleOAuthButton 
                            onSuccess={handleGoogleConnectionSuccess}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* HubSpot CRM Integration Card */}
                <Card className="relative overflow-hidden shadow-none border border-gray-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 flex items-center justify-center">
                          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 13.107 13.099" preserveAspectRatio="xMidYMid">
                            <path d="M12.027 6.222a3.33 3.33 0 0 0-1.209-1.201c-.382-.222-.777-.363-1.223-.424V3a1.17 1.17 0 0 0 .722-1.097 1.2 1.2 0 0 0-1.2-1.206 1.21 1.21 0 0 0-1.21 1.206c0 .49.26.908.707 1.097v1.588a3.49 3.49 0 0 0-1.064.334L3.275 1.685c.03-.113.056-.23.056-.353 0-.738-.598-1.336-1.336-1.336S.66.594.66 1.332s.598 1.336 1.336 1.336c.252 0 .485-.074.686-.195l.28.212L6.797 5.45c-.203.186-.392.398-.543.636-.306.485-.493 1.018-.493 1.6v.12a3.35 3.35 0 0 0 .21 1.156c.116.316.286.604.497.864l-1.274 1.277c-.377-.14-.8-.047-1.085.238-.194.193-.303.456-.302.73s.108.535.303.73.456.303.73.303.537-.108.73-.303.303-.456.302-.73a1.03 1.03 0 0 0-.048-.31l1.316-1.316c.18.125.375.23.585.32a3.42 3.42 0 0 0 1.369.288h.09c.552 0 1.073-.13 1.562-.395a3.23 3.23 0 0 0 1.224-1.153c.307-.49.475-1.033.475-1.63v-.03c0-.587-.136-1.128-.42-1.624zM10.42 8.984c-.357.397-.768.642-1.232.642H9.1c-.265 0-.525-.073-.778-.207a1.8 1.8 0 0 1-.682-.621c-.184-.26-.284-.544-.284-.845v-.09c0-.296.057-.577.2-.842.153-.3.36-.515.635-.694s.558-.265.88-.265h.03c.29 0 .567.057.827.19a1.75 1.75 0 0 1 .65.591 1.88 1.88 0 0 1 .291.83l.007.187c0 .407-.156.784-.467 1.126z" fill="#f8761f"/>
                          </svg>
                        </div>
                        <div>
                          <CardTitle className="text-lg">HubSpot CRM</CardTitle>
                          <CardDescription className="text-sm">
                            Connect Contacts, Companies, Deals, and Tickets
                          </CardDescription>
                        </div>
                      </div>
                      {hubspotIntegration ? (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <XCircleIcon className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {hubspotIntegration ? (
                      <>
                        {/* Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Connected on {formatDate(hubspotIntegration.created_at)}
                          </div>
                          
                          {/* Enabled Services */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Enabled Services:</div>
                            <div className="flex flex-wrap gap-2">
                              {hubspotEnabledServices.map(service => (
                                <Badge key={service.key} variant="outline" className="flex items-center space-x-1">
                                  {getServiceIcon(service.key)}
                                  <span>{service.name}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col space-y-2 pt-2">
                            <HubSpotOAuthButton 
                              onSuccess={handleHubSpotConnectionSuccess}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            />
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleDisconnectHubSpot}
                              disabled={isDisconnecting.hubspot}
                              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              {isDisconnecting.hubspot ? 'Disconnecting...' : 'Disconnect'}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Not Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Enable AI agents to access your HubSpot CRM data for enhanced functionality.
                          </div>
                          
                          {/* Available Services */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Available Services:</div>
                            <div className="space-y-1 text-sm text-text-secondary">
                              <div className="flex items-center space-x-2">
                                <UsersIcon className="h-3 w-3" />
                                <span>Contacts - Manage leads and customers</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <BuildingOffice2Icon className="h-3 w-3" />
                                <span>Companies - Track organizations</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CurrencyDollarIcon className="h-3 w-3" />
                                <span>Deals - Monitor sales opportunities</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <TicketIcon className="h-3 w-3" />
                                <span>Tickets - Handle support requests</span>
                              </div>
                            </div>
                          </div>

                          {/* Connect Button */}
                          <HubSpotOAuthButton 
                            onSuccess={handleHubSpotConnectionSuccess}
                            className="w-full"
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* QuickBooks Integration Card */}
                <Card className="relative overflow-hidden shadow-none border border-gray-200">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 flex items-center justify-center">
                         <svg enableBackground="new 0 0 2500 2500" viewBox="0 0 2500 2500" xmlns="http://www.w3.org/2000/svg"><circle cx="1250" cy="1250" fill="#2ca01c" r="1250"/><path d="m301.3 1249.6c.1 282.6 228 512.4 510.6 514.9h72.3v-188.9h-72.3c-175.2 47.8-355.9-55.5-403.6-230.7-.4-1.4-.7-2.8-1.1-4.2-49.1-177.5 53.7-361.4 230.6-412.5h36.1c45.3-9.9 92.2-9.9 137.5 0h175.6v1002.9c-.9 106.1 84.4 192.9 190.5 193.9v-1395.4h-364.5c-284.6 1.5-514 233.4-512.5 518v.1zm1387.5-519.8h-72.3v198.9h72.3c174.8-47.7 355.1 55.3 402.8 230 .4 1.3.7 2.7 1.1 4 48.8 176.9-53.7 360.1-229.9 411.1h-36.1c-45.3 9.9-92.2 9.9-137.5 0h-175.6v-1002.8c.9-106.1-84.4-192.9-190.5-193.9v1397.4h364.5c287.1-4.5 516.2-240.8 511.8-527.9-4.4-280.8-230.9-507.4-511.8-511.8z" fill="#fff"/></svg>
                        </div>
                        <div>
                          <CardTitle className="text-lg">QuickBooks Online</CardTitle>
                          <CardDescription className="text-sm">
                            Connect Customers, Invoices, Payments, and Items
                          </CardDescription>
                        </div>
                      </div>
                      {quickbooksIntegration ? (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <XCircleIcon className="h-3 w-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {quickbooksIntegration ? (
                      <>
                        {/* Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Connected to QuickBooks Online. Your AI agents can now access accounting data.
                          </div>

                          {/* Enabled Services */}
                          {quickbooksEnabledServices.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Enabled Features:</div>
                              <div className="flex flex-wrap gap-2">
                                {quickbooksEnabledServices.map((service) => (
                                  <Badge key={service.key} variant="secondary" className="flex items-center gap-1">
                                    {getServiceIcon(service.key)}
                                    {service.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Connection Info */}
                          <div className="space-y-1 text-xs text-text-secondary pt-2 border-t border-border">
                            <div>Connected: {formatDate(quickbooksIntegration.created_at)}</div>
                            <div>Last Updated: {formatDate(quickbooksIntegration.updated_at)}</div>
                          </div>
                        </div>

                        {/* Disconnect Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisconnectQuickBooks}
                          disabled={isDisconnecting.quickbooks}
                          className="w-full"
                        >
                          {isDisconnecting.quickbooks ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Disconnect
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Not Connected State */}
                        <div className="space-y-3">
                          <div className="text-sm text-text-secondary">
                            Connect your QuickBooks Online account to enable AI agents to access accounting data.
                          </div>

                          {/* Available Services */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Available Features:</div>
                            <div className="space-y-1 text-sm text-text-secondary">
                              <div className="flex items-center space-x-2">
                                <UsersIcon className="h-3 w-3" />
                                <span>Customers - Manage customer information</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <DocumentTextIcon className="h-3 w-3" />
                                <span>Invoices - Create and track invoices</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CurrencyDollarIcon className="h-3 w-3" />
                                <span>Payments - Record and track payments</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <BuildingOffice2Icon className="h-3 w-3" />
                                <span>Items - Manage products and services</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <TableCellsIcon className="h-3 w-3" />
                                <span>Accounts - View chart of accounts</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Connect Button */}
                        <QuickBooksOAuthButton
                          onSuccess={handleQuickBooksConnectionSuccess}
                          variant="default"
                          className="w-full"
                        />
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Placeholder for future integrations */}
                <Card className="border-dashed border-2 border-muted shadow-none border border-gray-200">
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
                    <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                      <PuzzlePieceIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-muted-foreground">More Integrations Coming Soon</CardTitle>
                      <CardDescription className="mt-2">
                        We're working on adding more third-party integrations to enhance your workflow.
                      </CardDescription>
                    </div>
                  </CardContent>
                </Card>

              </div>

            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}