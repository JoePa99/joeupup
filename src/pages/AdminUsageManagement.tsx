import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, Download, UserPlus, AlertCircle, TrendingUp } from 'lucide-react';
import { useCompanyUsage } from '@/hooks/useUsage';
import { getUsageColorClasses, getUsageColor } from '@/lib/usage-utils';
import { formatPrice, openCustomerPortal } from '@/lib/stripe-client';
import { toast } from 'sonner';

export default function AdminUsageManagement() {
  const { users, subscription, isLoading, error } = useCompanyUsage();
  const [searchTerm, setSearchTerm] = useState('');

  const handleManageBilling = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      toast.error('Unable to open billing portal');
    }
  };

  const handleExportCSV = () => {
    if (!users || users.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Name', 'Email', 'Messages Used', 'Messages Limit', 'Usage %', 'Last Active'];
    const rows = users.map(user => [
      user.user_name,
      user.user_email,
      user.messages_used,
      user.messages_limit,
      user.usage_percentage,
      user.last_message_at || 'Never',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usage-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Usage report exported');
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate company-wide stats
  const totalUsed = users.reduce((sum, user) => sum + user.messages_used, 0);
  const totalLimit = users.reduce((sum, user) => sum + user.messages_limit, 0);
  const averageUsage = users.length > 0 ? totalUsed / users.length : 0;
  
  // Get seat info from subscription
  const purchasedSeats = subscription?.purchased_seats || users.length;
  const activeUsers = users.length;
  const availableSeats = Math.max(0, purchasedSeats - activeUsers);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load usage data. You may not have permission to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 bg-white">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Team Usage Management</h1>
          <p className="text-muted-foreground">Monitor and manage your team's message usage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleManageBilling}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Seats
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="pb-3">
            <CardDescription>Total Team Usage</CardDescription>
            <CardTitle className="text-4xl">{totalUsed.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              of {totalLimit.toLocaleString()} total messages
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="pb-3">
            <CardDescription>Average per User</CardDescription>
            <CardTitle className="text-4xl">{Math.round(averageUsage).toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              messages used
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="pb-3">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-4xl">{activeUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              of {purchasedSeats} purchased seats
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="pb-3">
            <CardDescription>Available Seats</CardDescription>
            <CardTitle className="text-4xl">{availableSeats}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {availableSeats === 0 ? (
                <span className="text-red-600 font-medium">Add more seats</span>
              ) : (
                'seats remaining'
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Table */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Individual usage breakdown for all team members</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Usage %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No team members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const color = getUsageColor(user.usage_percentage);
                    const colorClasses = getUsageColorClasses(color);
                    
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.user_name}</p>
                            <p className="text-sm text-muted-foreground">{user.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {user.messages_used.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.messages_limit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={colorClasses.text}>
                            {user.usage_percentage}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={color === 'green' ? 'default' : color === 'yellow' ? 'secondary' : 'destructive'}
                            className={colorClasses.bg}
                          >
                            {color === 'green' ? 'Good' : color === 'yellow' ? 'Warning' : 'Critical'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_message_at 
                            ? new Date(user.last_message_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      {subscription?.subscription_plans && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 border border-gray-200 shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Manage Your Subscription</CardTitle>
            </div>
            <CardDescription>
              Current Plan: <strong>{subscription.subscription_plans.name}</strong> - {formatPrice(subscription.subscription_plans.price_monthly)}/seat/month
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button onClick={handleManageBilling}>
              Add More Seats
            </Button>
            <Button onClick={handleManageBilling} variant="outline">
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}






