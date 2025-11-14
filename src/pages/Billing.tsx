import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Calendar, Download, Settings, AlertCircle, CheckCircle2, Users, TrendingUp, ExternalLink } from 'lucide-react';
import { useCompanySubscription } from '@/hooks/useSubscription';
import { useSeatValidation } from '@/hooks/useSeatValidation';
import { openCustomerPortal, formatPrice } from '@/lib/stripe-client';
import { triggerUpgradeFlow, calculateRequiredSeats } from '@/lib/subscription-upgrade';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { jsonToStringArray } from '@/types/stripe';

export default function Billing() {
  const { user } = useAuth();
  const { subscription, plan, isLoading, error } = useCompanySubscription();
  const { 
    purchasedSeats, 
    activeMembers, 
    pendingInvitations, 
    availableSeats, 
    usagePercentage, 
    isUnlimited,
    isLoading: seatLoading 
  } = useSeatValidation();
  const [seatUsage, setSeatUsage] = useState<any>(null);
  const [loadingSeatUsage, setLoadingSeatUsage] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Fetch seat usage
  useEffect(() => {
    const fetchSeatUsage = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          const { data, error } = await supabase
            .from('company_seat_usage')
            .select('*')
            .eq('company_id', profile.company_id)
            .single();

          if (!error && data) {
            setSeatUsage(data);
          }
        }
      } catch (err) {
        console.error('Error fetching seat usage:', err);
      } finally {
        setLoadingSeatUsage(false);
      }
    };

    fetchSeatUsage();
  }, [user]);

  const handleUpgrade = async () => {
    if (!user) return;
    
    setIsUpgrading(true);
    try {
      const recommendedSeats = calculateRequiredSeats(purchasedSeats, activeMembers + pendingInvitations + 1);
      const upgradeData = await triggerUpgradeFlow('', user.id, recommendedSeats);
      if (upgradeData?.url) {
        window.location.href = upgradeData.url;
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      toast.error('Unable to open billing portal');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load billing information. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isActive = subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trialing';
  const statusColor = isActive ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className="container mx-auto py-6 sm:py-8 space-y-4 sm:space-y-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your subscription and billing information</p>
        </div>
        {isActive && (
          <Button onClick={handleManageBilling} size="lg" className="w-full sm:w-auto">
            <Settings className="mr-2 h-4 w-4" />
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Status Alert */}
      {!isActive && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription is not active. Please subscribe to a plan to continue using the platform.
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Seat Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Seat Usage
          </CardTitle>
          <CardDescription>
            {isUnlimited ? "Unlimited seats" : "Active team members vs purchased seats"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {seatLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold">{activeMembers}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Members</p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <p className="text-xl sm:text-2xl font-bold">{pendingInvitations}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending Invitations</p>
                </div>
              </div>
              
              <div className="text-center p-3 sm:p-4 bg-primary/5 rounded-lg">
                <p className="text-2xl sm:text-3xl font-bold">
                  {isUnlimited ? "∞" : `${activeMembers + pendingInvitations} / ${purchasedSeats}`}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Used / Purchased</p>
              </div>

              {!isUnlimited && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Available Seats</span>
                      <Badge variant={availableSeats <= 0 ? "destructive" : availableSeats <= 2 ? "default" : "secondary"}>
                        {availableSeats}
                      </Badge>
                    </div>
                    <Progress 
                      value={usagePercentage} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground text-center">
                      {usagePercentage}% utilization
                    </div>
                  </div>

                  {availableSeats <= 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You have reached your seat limit. Upgrade your plan to invite more team members.
                      </AlertDescription>
                    </Alert>
                  )}

                  {availableSeats > 0 && availableSeats <= 2 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        You are approaching your seat limit. Consider upgrading your plan.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = '/team-management'}
                      className="flex-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Manage Team
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleUpgrade}
                      disabled={isUpgrading}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {isUpgrading ? "Upgrading..." : "Upgrade Plan"}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Subscription Overview */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className={`h-5 w-5 ${statusColor}`} />
              Subscription Status
            </CardTitle>
            <CardDescription>Your current subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plan</p>
                  <p className="text-2xl font-bold">{plan.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className={`text-xl font-semibold capitalize ${statusColor}`}>
                    {subscription?.subscription_status || 'Inactive'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Price</p>
                  <p className="text-xl">{formatPrice(plan.price_monthly)}/seat/month</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Messages per Seat</p>
                  <p className="text-xl">{plan.message_limit_per_seat.toLocaleString()}</p>
                </div>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No active subscription. Please select a plan to get started.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Billing Period
            </CardTitle>
            <CardDescription>Current billing cycle information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription?.subscription_current_period_start && subscription?.subscription_current_period_end ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Period Start</p>
                  <p className="text-lg">
                    {new Date(subscription.subscription_current_period_start).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Period End</p>
                  <p className="text-lg">
                    {new Date(subscription.subscription_current_period_end).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Renewal</p>
                  <p className="text-lg">
                    {Math.ceil((new Date(subscription.subscription_current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No billing period information available
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing Management */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
          <CardDescription>Manage your payment method, view invoices, and update billing details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleManageBilling} className="w-full sm:w-auto">
              <CreditCard className="mr-2 h-4 w-4" />
              Update Payment Method
            </Button>
            <Button onClick={handleManageBilling} variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              View Invoices
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Click "Manage Subscription" to access the billing portal where you can:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Update your payment method</li>
            <li>View and download invoices</li>
            <li>Change your subscription plan</li>
            <li>Add or remove seats</li>
            <li>Cancel your subscription</li>
          </ul>
        </CardContent>
      </Card>

      {/* Plan Features */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
            <CardDescription>What's included in your {plan.name} plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {jsonToStringArray(plan.features).map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}






