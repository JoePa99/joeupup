import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { PricingCard } from '@/components/billing/PricingCard';
import { useSubscriptionPlans } from '@/hooks/useSubscription';
import { createCheckoutSession } from '@/lib/stripe-client';
import { useIsPlatformAdmin } from '@/hooks/useAdminData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface SubscriptionRequiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
  companyId: string;
  isAdmin: boolean;
}

export function SubscriptionRequiredModal({
  isOpen,
  onClose,
  companyId,
  isAdmin,
}: SubscriptionRequiredModalProps) {
  const { plans, isLoading, error } = useSubscriptionPlans();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { signOut } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [seats, setSeats] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  
  // User can checkout if they are company admin OR platform admin
  const canCheckout = isAdmin || isPlatformAdmin;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleSeatsChange = (value: string) => {
    const numValue = parseInt(value) || 1;
    const maxSeats = selectedPlan?.seat_limit || 999;
    setSeats(Math.max(1, Math.min(numValue, maxSeats)));
  };

  const handleSubscribe = async () => {
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }

    try {
      setIsProcessing(true);
      
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}${window.location.pathname}?subscription_success=true`;
      const cancelUrl = `${baseUrl}${window.location.pathname}?subscription_canceled=true`;

      // Redirect to Stripe Checkout
      await createCheckoutSession(selectedPlanId, seats, successUrl, cancelUrl);
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error?.message || error?.context?.body?.error || 'Failed to start checkout';
      toast.error(errorMessage);
      setIsProcessing(false);
    }
  };

  const handleNonAdminAction = () => {
    setShowLogoutAlert(true);
  };

  const handleLogout = async () => {
    await signOut();
    setShowLogoutAlert(false);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || plans.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load subscription plans. Please try again later.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-6xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
            {canCheckout ? 'Choose Your Subscription Plan' : 'Subscription Required'}
          </DialogTitle>
          <DialogDescription>
            {canCheckout 
              ? 'Select the plan that best fits your team\'s needs to continue using the platform.'
              : 'Your company needs an active subscription to use this platform. Please contact your administrator.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Non-admin alert */}
          {!canCheckout && (
            <Alert>
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <AlertDescription>
                Your company needs an active subscription. Review the plans below and contact your company administrator to complete the purchase.
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing cards - visible to everyone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {plans.map((plan, index) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                seats={canCheckout && selectedPlanId === plan.id ? seats : 1}
                isPopular={index === 1}
                onSelect={handleSelectPlan}
                disabled={!canCheckout || isProcessing}
              />
            ))}
          </div>

          {/* Seat selector - only for admins and platform admins */}
          {canCheckout && selectedPlan && (
            <div className="max-w-full sm:max-w-xs mx-auto space-y-2">
              <Label htmlFor="modal-seats">Number of Seats</Label>
              <Input
                id="modal-seats"
                type="number"
                min="1"
                max={selectedPlan.seat_limit || 999}
                value={seats}
                onChange={(e) => handleSeatsChange(e.target.value)}
                className="text-center text-lg font-semibold"
              />
              {selectedPlan.seat_limit && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum {selectedPlan.seat_limit} seats for this plan
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
            {canCheckout && (
              <Button
                size="lg"
                onClick={handleSubscribe}
                disabled={!selectedPlanId || isProcessing}
                className="w-full sm:w-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue to Checkout'
                )}
              </Button>
            )}
            <Button onClick={handleNonAdminAction} variant="outline" size="lg" className="w-full sm:w-auto">
              I Understand
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {canCheckout 
              ? 'All plans include a 14-day free trial. You can change your plan anytime.'
              : 'Only company administrators or platform administrators can purchase subscriptions.'}
          </p>
        </div>
      </DialogContent>

      <AlertDialog open={showLogoutAlert} onOpenChange={setShowLogoutAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Subscription Required</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Your company needs an active subscription to use this platform.
              </p>
              {canCheckout ? (
                <p className="font-semibold">
                  Please select a plan above to continue, or contact support if you need assistance.
                </p>
              ) : (
                <p className="font-semibold">
                  Please contact your company administrator to purchase a subscription plan.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                If you'd like to sign out and use a different account, click the logout button below.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay Here</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

