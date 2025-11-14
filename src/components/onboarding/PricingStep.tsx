import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PricingCard } from '@/components/billing/PricingCard';
import { useSubscriptionPlans } from '@/hooks/useSubscription';
import { createCheckoutSession } from '@/lib/stripe-client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PricingStepProps {
  onComplete?: () => void;
  companyId: string;
}

export function PricingStep({ onComplete, companyId }: PricingStepProps) {
  const { plans, isLoading, error } = useSubscriptionPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [seats, setSeats] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Check current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!companyId) return;

      const { data: company } = await supabase
        .from('companies')
        .select('subscription_status, plan_id')
        .eq('id', companyId)
        .single();

      if (company) {
        setSubscriptionStatus(company.subscription_status);
        setCurrentPlanId(company.plan_id);
      }
    };

    checkSubscription();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('subscription-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${companyId}`,
        },
        (payload) => {
          const newCompany = payload.new as any;
          setSubscriptionStatus(newCompany.subscription_status);
          setCurrentPlanId(newCompany.plan_id);
          
          if (newCompany.subscription_status === 'active' || newCompany.subscription_status === 'trialing') {
            toast.success('Your subscription is now active!');
            if (onComplete) {
              setTimeout(() => onComplete(), 1500);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, onComplete]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

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
      const successUrl = `${baseUrl}/onboarding?step=3&success=true`;
      const cancelUrl = `${baseUrl}/onboarding?step=2&canceled=true`;

      // Redirect to Stripe Checkout
      await createCheckoutSession(selectedPlanId, seats, successUrl, cancelUrl);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleSkipForNow = () => {
    // For MVP, we might want to allow skipping and setting up billing later
    if (onComplete) {
      onComplete();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || plans.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Unable to load subscription plans. Please refresh the page or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Show success message if subscription is active
  const isSubscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

  if (isSubscriptionActive && currentPlanId) {
    const currentPlan = plans.find(p => p.id === currentPlanId);
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Subscription Active!</h2>
          <p className="text-muted-foreground mt-2">
            You're subscribed to the <strong>{currentPlan?.name}</strong> plan.
          </p>
        </div>
        <Button onClick={onComplete} size="lg">
          Continue to Next Step
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Select the plan that best fits your team's needs
        </p>
      </div>

      {/* Seat selector */}
      {selectedPlan && (
        <div className="max-w-xs mx-auto space-y-2">
          <Label htmlFor="seats">Number of Seats</Label>
          <Input
            id="seats"
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

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan, index) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            seats={selectedPlanId === plan.id ? seats : 1}
            isPopular={index === 1} // Professional plan is most popular
            onSelect={handleSelectPlan}
            disabled={isProcessing}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
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
        
        <Button
          variant="ghost"
          size="lg"
          onClick={handleSkipForNow}
          disabled={isProcessing}
          className="w-full sm:w-auto"
        >
          Skip for now
        </Button>
      </div>

      <div className="text-center text-sm text-muted-foreground max-w-md mx-auto">
        <p>
          You can change your plan or add more seats at any time from your billing settings.
          All plans include a 14-day free trial.
        </p>
      </div>
    </div>
  );
}

