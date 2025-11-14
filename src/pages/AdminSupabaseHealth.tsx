import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/ui/admin-sidebar';
import { PlatformAdminProtectedRoute } from '@/components/auth/PlatformAdminProtectedRoute';
import {
  Activity,
  Database,
  HardDrive,
  Shield,
  Radio,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  TrendingUp,
  Users,
  Server,
  Globe,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  checkSupabaseHealth,
  getDatabaseMetrics,
  getStorageMetrics,
  getUsageMetrics,
  getSupabaseProjectInfo,
  type SupabaseHealthMetrics,
  type DatabaseMetrics,
  type StorageMetrics,
  type UsageMetrics,
} from '@/utils/supabaseHealth';
import { cn } from '@/lib/utils';

function SupabaseHealthContent() {
  const [healthMetrics, setHealthMetrics] = useState<SupabaseHealthMetrics | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const projectInfo = getSupabaseProjectInfo();

  useEffect(() => {
    fetchAllMetrics();
  }, []);

  const fetchAllMetrics = async () => {
    setLoading(true);
    try {
      const [health, database, storage, usage] = await Promise.all([
        checkSupabaseHealth(),
        getDatabaseMetrics(),
        getStorageMetrics(),
        getUsageMetrics(),
      ]);

      setHealthMetrics(health);
      setDatabaseMetrics(database);
      setStorageMetrics(storage);
      setUsageMetrics(usage);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Supabase health metrics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllMetrics();
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Health metrics updated successfully',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return 'text-green-500';
      case 'degraded':
      case 'unknown':
        return 'text-yellow-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return CheckCircle;
      case 'degraded':
      case 'unknown':
        return AlertTriangle;
      case 'down':
        return AlertCircle;
      default:
        return Activity;
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return 'default';
      case 'degraded':
      case 'unknown':
        return 'secondary';
      case 'down':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Loading Supabase Health
          </h2>
          <p className="text-text-secondary">Checking all services...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Supabase Health Monitor
            </h1>
            <p className="text-text-secondary">
              Real-time status and metrics for your Supabase instance
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Overall Status Card */}
        {healthMetrics && (
          <Card className="p-6 border-2 border-gray-200 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(() => {
                    const StatusIcon = getStatusIcon(healthMetrics.connectionStatus);
                    return (
                      <div
                        className={cn(
                          'p-4 rounded-full',
                          healthMetrics.connectionStatus === 'healthy' && 'bg-green-100',
                          healthMetrics.connectionStatus === 'degraded' && 'bg-yellow-100',
                          healthMetrics.connectionStatus === 'down' && 'bg-red-100'
                        )}
                      >
                        <StatusIcon
                          className={cn('h-8 w-8', getStatusColor(healthMetrics.connectionStatus))}
                        />
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-1">
                      System Status:{' '}
                      <span className={getStatusColor(healthMetrics.connectionStatus)}>
                        {healthMetrics.connectionStatus.charAt(0).toUpperCase() +
                          healthMetrics.connectionStatus.slice(1)}
                      </span>
                    </h2>
                    <p className="text-text-secondary">
                      Response time: {healthMetrics.responseTime}ms • Last checked:{' '}
                      {new Date(healthMetrics.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(healthMetrics.connectionStatus)} className="text-lg px-4 py-2">
                  {healthMetrics.connectionStatus === 'healthy' && '✓ All Systems Operational'}
                  {healthMetrics.connectionStatus === 'degraded' && '⚠ Degraded Performance'}
                  {healthMetrics.connectionStatus === 'down' && '✕ Service Disruption'}
                </Badge>
              </div>
            </Card>
          )}

        {/* Service Status Grid */}
        {healthMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { name: 'Database', status: healthMetrics.databaseStatus, icon: Database },
                { name: 'Storage', status: healthMetrics.storageStatus, icon: HardDrive },
                { name: 'Auth', status: healthMetrics.authStatus, icon: Shield },
                { name: 'Realtime', status: healthMetrics.realtimeStatus, icon: Radio },
              ].map((service) => {
                const Icon = service.icon;
                const StatusIcon = getStatusIcon(service.status);
                return (
                  <Card key={service.name} className="p-6 border border-gray-200 shadow-none">
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                      <StatusIcon className={cn('h-5 w-5', getStatusColor(service.status))} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">{service.name}</h3>
                    <Badge variant={getStatusBadgeVariant(service.status)} className="capitalize">
                      {service.status}
                    </Badge>
                  </Card>
                );
              })}
            </div>
          )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Metrics */}
            {databaseMetrics && (
              <Card className="p-6 border border-gray-200 shadow-none">
                <div className="flex items-center gap-3 mb-6">
                  <Database className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Database Metrics</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Total Tables</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {databaseMetrics.totalTables}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Total Rows</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {databaseMetrics.totalRows.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Active Connections</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {databaseMetrics.activeConnections}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Storage Metrics */}
            {storageMetrics && (
              <Card className="p-6 border border-gray-200 shadow-none">
                <div className="flex items-center gap-3 mb-6">
                  <HardDrive className="h-6 w-6 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Storage Metrics</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Total Buckets</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {storageMetrics.totalBuckets}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Total Files</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {storageMetrics.totalFiles.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Storage Used</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {storageMetrics.storageUsed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-muted-foreground" />
                      <span className="text-foreground">Storage Limit</span>
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {storageMetrics.storageLimit}
                    </span>
                  </div>
                </div>
              </Card>
            )}
        </div>

        {/* Usage Metrics */}
        {usageMetrics && (
          <Card className="p-6 border border-gray-200 shadow-none">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Usage Statistics</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="text-foreground">Auth Users</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {usageMetrics.authUsers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <span className="text-foreground">API Requests (Est.)</span>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {usageMetrics.apiRequests.toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-text-secondary mt-4 text-center">
                Period: {usageMetrics.period}
              </div>
            </div>
          </Card>
        )}

        {/* Project Information */}
        <Card className="p-6 border border-gray-200 shadow-none">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Project Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-subtle rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Project URL</p>
                <p className="text-foreground font-mono text-sm break-all">{projectInfo.url}</p>
              </div>
              <div className="p-4 bg-surface-subtle rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Project Reference</p>
                <p className="text-foreground font-mono text-sm">{projectInfo.projectRef}</p>
              </div>
              <div className="p-4 bg-surface-subtle rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Region</p>
                <p className="text-foreground">{projectInfo.region}</p>
              </div>
              <div className="p-4 bg-surface-subtle rounded-lg">
                <p className="text-sm text-text-secondary mb-1">Environment</p>
                <Badge>{projectInfo.environment}</Badge>
              </div>
            </div>
        </Card>

        {/* Error Log */}
        {healthMetrics && healthMetrics.errors.length > 0 && (
            <Card className="p-6 border-red-200 bg-red-50 border border-gray-200 shadow-none">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <h2 className="text-xl font-semibold text-red-900">Recent Errors</h2>
              </div>
              <div className="space-y-3">
                {healthMetrics.errors.map((error, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-red-900">{error.service}</span>
                          <span className="text-xs text-red-700">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(error.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-red-800">{error.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
      </div>
    </div>
  );
}

export default function AdminSupabaseHealth() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Supabase Health</h2>
            </header>
            <SupabaseHealthContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

