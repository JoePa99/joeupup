import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRightIcon, ArrowTrendingUpIcon, CalendarIcon, ExclamationCircleIcon, CreditCardIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useUsage } from '@/hooks/useUsage';
import { useCompanySubscription } from '@/hooks/useSubscription';
import { UsageProgressBar } from '@/components/usage/UsageProgressBar';
import { openCustomerPortal } from '@/lib/stripe-client';
import { getUsageIndicatorData, formatPeriodRange, formatDaysRemaining, getUsageWarningMessage } from '@/lib/usage-utils';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState } from 'react';

export default function Usage() {
  const { usage, history, isLoading, error } = useUsage(true);
  const { subscription, plan, isLoading: isLoadingSubscription } = useCompanySubscription();
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);

  const handleUpgrade = () => {
    setShowRedirectDialog(true);
  };

  const handleConfirmRedirect = async () => {
    try {
      setShowRedirectDialog(false);
      const returnUrl = `${window.location.origin}/client-dashboard/usage`;
      await openCustomerPortal(returnUrl);
    } catch (error) {
      toast.error('Unable to open billing portal');
    }
  };

  if (isLoading || isLoadingSubscription) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <ExclamationCircleIcon className="h-4 w-4" />
          <AlertDescription>
            Unable to load usage data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Calculate total plan messages: message_limit_per_seat * purchased_seats
  const totalPlanMessages = plan && subscription?.purchased_seats 
    ? plan.message_limit_per_seat * subscription.purchased_seats 
    : usage.messages_limit;
  
  const indicatorData = getUsageIndicatorData(usage.messages_used, totalPlanMessages);
  const warningMessage = getUsageWarningMessage(usage.messages_used, totalPlanMessages);

  // Format history data for chart
  const chartData = history.slice(0, 6).reverse().map((h) => ({
    period: new Date(h.period_start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    used: h.messages_used,
    limit: h.messages_limit,
  }));

  return (
    <div className="w-full py-6 sm:py-8 space-y-4 sm:space-y-6 bg-white min-h-full px-4 sm:px-6">

      {/* Warning Alert */}
      {warningMessage && (
        <Alert variant={indicatorData.color === 'red' ? 'destructive' : 'default'}>
          <ExclamationCircleIcon className="h-4 w-4" />
          <AlertDescription>{warningMessage}</AlertDescription>
        </Alert>
      )}

      {/* Current Usage Stats */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="pb-3">
            <CardDescription>Messages Used</CardDescription>
            <CardTitle className="text-3xl sm:text-4xl">{usage.messages_used.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              of {totalPlanMessages.toLocaleString()} total
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="pb-3">
            <CardDescription>Remaining</CardDescription>
            <CardTitle className="text-3xl sm:text-4xl">{indicatorData.messages_remaining.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {indicatorData.percentage}% used
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Current Period
            </CardDescription>
            <CardTitle className="text-lg sm:text-xl">
              {formatPeriodRange(usage.period_start, usage.period_end)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {formatDaysRemaining(usage.period_end)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Progress */}
      <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Current Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageProgressBar
            used={usage.messages_used}
            limit={totalPlanMessages}
            color={indicatorData.color}
            size="md"
          />
        </CardContent>
      </Card>

      {/* Subscription Details */}
      {plan && (
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plan</p>
                <p className="text-xl sm:text-2xl font-bold">{plan.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-xl sm:text-2xl font-bold capitalize">{subscription?.subscription_status || 'Inactive'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages per Seat</p>
                <p className="text-lg sm:text-xl">{plan.message_limit_per_seat.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Seat Limit</p>
                <p className="text-lg sm:text-xl">{plan.seat_limit ? plan.seat_limit.toLocaleString() : 'Unlimited'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage History Chart */}
      {chartData.length > 0 && (
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader>
            <CardTitle>Usage History</CardTitle>
            <CardDescription>Your message usage over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="used" fill="hsl(var(--primary))" name="Used" />
                <Bar dataKey="limit" fill="hsl(var(--muted))" name="Limit" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Manage Billing Button */}
      {subscription?.subscription_status === 'active' && (
        <Button 
          onClick={handleUpgrade} 
          className="w-full bg-white text-[#6772e5] text-[14px] font-bold border border-gray-200 rounded-sm hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" fill="#6772e5"><path d="M111.328 15.602c0-4.97-2.415-8.9-7.013-8.9s-7.423 3.924-7.423 8.863c0 5.85 3.32 8.8 8.036 8.8 2.318 0 4.06-.528 5.377-1.26V19.22a10.246 10.246 0 0 1-4.764 1.075c-1.9 0-3.556-.67-3.774-2.943h9.497a39.64 39.64 0 0 0 .063-1.748zm-9.606-1.835c0-2.186 1.35-3.1 2.56-3.1s2.454.906 2.454 3.1zM89.4 6.712a5.434 5.434 0 0 0-3.801 1.509l-.254-1.208h-4.27v22.64l4.85-1.032v-5.488a5.434 5.434 0 0 0 3.444 1.265c3.472 0 6.64-2.792 6.64-8.957.003-5.66-3.206-8.73-6.614-8.73zM88.23 20.1a2.898 2.898 0 0 1-2.288-.906l-.03-7.2a2.928 2.928 0 0 1 2.315-.96c1.775 0 2.998 2 2.998 4.528.003 2.593-1.198 4.546-2.995 4.546zM79.25.57l-4.87 1.035v3.95l4.87-1.032z" fill-rule="evenodd"/><path d="M74.38 7.035h4.87V24.04h-4.87z"/><path d="M69.164 8.47l-.302-1.434h-4.196V24.04h4.848V12.5c1.147-1.5 3.082-1.208 3.698-1.017V7.038c-.646-.232-2.913-.658-4.048 1.43zm-9.73-5.646L54.698 3.83l-.02 15.562c0 2.87 2.158 4.993 5.038 4.993 1.585 0 2.756-.302 3.405-.643v-3.95c-.622.248-3.683 1.138-3.683-1.72v-6.9h3.683V7.035h-3.683zM46.3 11.97c0-.758.63-1.05 1.648-1.05a10.868 10.868 0 0 1 4.83 1.25V7.6a12.815 12.815 0 0 0-4.83-.888c-3.924 0-6.557 2.056-6.557 5.488 0 5.37 7.375 4.498 7.375 6.813 0 .906-.78 1.186-1.863 1.186-1.606 0-3.68-.664-5.307-1.55v4.63a13.461 13.461 0 0 0 5.307 1.117c4.033 0 6.813-1.992 6.813-5.485 0-5.796-7.417-4.76-7.417-6.943zM13.88 9.515c0-1.37 1.14-1.9 2.982-1.9A19.661 19.661 0 0 1 25.6 9.876v-8.27A23.184 23.184 0 0 0 16.862.001C9.762.001 5 3.72 5 9.93c0 9.716 13.342 8.138 13.342 12.326 0 1.638-1.4 2.146-3.37 2.146-2.905 0-6.657-1.202-9.6-2.802v8.378A24.353 24.353 0 0 0 14.973 32C22.27 32 27.3 28.395 27.3 22.077c0-10.486-13.42-8.613-13.42-12.56z" fill-rule="evenodd"/></svg>
           Manage Billing
        </Button>
      )}

      {/* Stripe Redirect Alert Dialog */}
      <AlertDialog open={showRedirectDialog} onOpenChange={setShowRedirectDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <ArrowTopRightOnSquareIcon className="h-5 w-5 text-[#6772e5]" />
              <AlertDialogTitle>Redirecting to Stripe</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              You will be redirected to Stripe's secure billing portal to manage your subscription, payment methods, and view invoices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRedirect}
              className="w-full sm:w-auto bg-[#6772e5] hover:bg-[#5a67d3]"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}





