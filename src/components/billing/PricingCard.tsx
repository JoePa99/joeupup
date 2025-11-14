import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import type { SubscriptionPlan } from '@/types/stripe';
import { formatPrice } from '@/lib/stripe-client';
import { jsonToStringArray } from '@/types/stripe';

interface PricingCardProps {
  plan: SubscriptionPlan;
  seats?: number;
  isCurrentPlan?: boolean;
  isPopular?: boolean;
  onSelect: (planId: string) => void;
  disabled?: boolean;
}

export function PricingCard({
  plan,
  seats = 1,
  isCurrentPlan = false,
  isPopular = false,
  onSelect,
  disabled = false,
}: PricingCardProps) {
  const monthlyPrice = formatPrice(plan.price_monthly);
  const totalPrice = formatPrice(plan.price_monthly * seats);

  const features = jsonToStringArray(plan.features);

  return (
    <Card className={`relative ${isPopular ? 'border-primary shadow-lg sm:scale-105' : ''} ${isCurrentPlan ? 'border-green-500' : ''}`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
            Current Plan
          </span>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl sm:text-2xl font-bold">{plan.name}</CardTitle>
        <CardDescription className="text-sm">
          {plan.description}
        </CardDescription>
        <div className="mt-4">
          <span className="text-3xl sm:text-4xl font-bold">{monthlyPrice}</span>
          <span className="text-muted-foreground">/seat/month</span>
        </div>
        {seats > 1 && (
          <div className="mt-2">
            <span className="text-lg text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{totalPrice}</span>/month
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Messages per seat</span>
            <span className="font-semibold">{plan.message_limit_per_seat.toLocaleString()}</span>
          </div>
          {plan.seat_limit && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Maximum seats</span>
              <span className="font-semibold">{plan.seat_limit}</span>
            </div>
          )}
          {!plan.seat_limit && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Seats</span>
              <span className="font-semibold">Unlimited</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={() => onSelect(plan.id)}
          disabled={disabled || isCurrentPlan}
          variant={isPopular ? 'default' : 'outline'}
        >
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}






