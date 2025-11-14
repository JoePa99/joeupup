# Subscription Required Modal Implementation

## Overview

The `SubscriptionRequiredModal` is an automatic paywall that displays when users try to access the platform without an active subscription. It prevents usage until payment is completed.

## Features

### For Company Admins
- **Full pricing options** displayed in modal
- **Seat selector** to choose number of seats
- **Direct checkout** from modal
- **Dismissible** - can close and navigate to billing page later
- Auto-shows when `plan_id` is null or subscription status is not active/trialing

### For Regular Users
- **Information message** explaining subscription is required
- **Non-dismissible** - cannot close modal
- **Contact admin prompt** with guidance to reach out
- No access to platform features until admin subscribes

## Implementation Details

### Files Created

1. **`src/components/billing/SubscriptionRequiredModal.tsx`**
   - Reusable modal component
   - Shows different content based on user role
   - Integrates pricing cards and checkout flow

2. **`src/hooks/useSubscriptionRequired.ts`**
   - Custom hook to check subscription status
   - Real-time updates via Supabase subscriptions
   - Returns modal state and user role info

### Integrated Into Pages

The modal has been added to all user-facing pages:
- ✅ `src/pages/ClientDashboard.tsx` - Main chat interface
- ✅ `src/pages/Welcome.tsx` - Home/landing page
- ✅ `src/pages/Documents.tsx` - Document management
- ✅ `src/pages/Settings.tsx` - User settings
- ✅ `src/pages/Playbook.tsx` - Company playbook

### Trigger Conditions

Modal shows when:
```typescript
!company.plan_id || 
(subscription_status !== 'active' && subscription_status !== 'trialing')
```

Modal hides when:
```typescript
company.plan_id && 
(subscription_status === 'active' || subscription_status === 'trialing')
```

## User Experience

### Scenario 1: Admin User Without Subscription

1. Admin logs in and navigates to any page
2. Modal appears immediately showing pricing plans
3. Admin selects plan and number of seats
4. Clicks "Continue to Checkout"
5. Redirected to Stripe Checkout
6. After payment, redirected back with `?subscription_success=true`
7. Modal detects payment and auto-closes
8. User can access platform normally

### Scenario 2: Regular User Without Subscription

1. User logs in and navigates to any page
2. Modal appears with "Contact Admin" message
3. Modal is non-dismissible (no X button)
4. User cannot access any platform features
5. User must wait for admin to set up subscription
6. Once admin pays, modal automatically disappears via real-time update

### Scenario 3: Subscription Expires

1. Company's subscription expires or payment fails
2. `subscription_status` changes to `past_due` or `canceled`
3. Modal automatically appears for all company users
4. Admin can click through to re-activate subscription
5. Regular users see "Contact Admin" message

## Real-Time Updates

The modal uses Supabase real-time subscriptions to update immediately when:
- Subscription status changes (active, inactive, past_due, etc.)
- Plan ID is added/updated
- Payment is processed by webhook

```typescript
supabase
  .channel('company-subscription-check')
  .on('postgres_changes', {
    event: 'UPDATE',
    table: 'companies',
    filter: `id=eq.${companyId}`
  }, (payload) => {
    // Auto-hide modal when subscription becomes active
    // Auto-show modal when subscription expires
  })
```

## Integration with Existing Features

### Works With Onboarding Flow
- If user skips pricing in onboarding, modal appears later
- Modal redirects to same success URL handling as onboarding
- Consistent checkout experience

### Works With Usage Tracking
- Once subscribed, usage tracking begins immediately
- Modal won't show again unless subscription expires
- Admin can always manage billing via `/billing` page

### Works With Team Invitations
- Invited users see modal if company hasn't subscribed
- Non-dismissible for non-admins prevents platform access
- Clear messaging about who needs to take action

## Modal Behavior

### Admin Experience
```
┌─────────────────────────────────────────┐
│  Choose Your Subscription Plan          │
├─────────────────────────────────────────┤
│  Select plan that fits your needs       │
│                                          │
│  [Number of Seats: ___ ]                │
│                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │Starter │  │  Pro   │  │Enterprise│   │
│  │  $59   │  │  $299  │  │ $1,199 │    │
│  └────────┘  └────────┘  └────────┘    │
│                                          │
│     [Continue to Checkout]              │
│                                          │
│  All plans include 14-day free trial    │
└─────────────────────────────────────────┘
```

### Non-Admin Experience
```
┌─────────────────────────────────────────┐
│    Subscription Required                 │
├─────────────────────────────────────────┤
│  ⚠️  Your company does not have an      │
│      active subscription.                │
│                                          │
│  Please ask your company administrator   │
│  to set up a subscription plan.          │
│                                          │
│           [Close]                        │
│  (Only closes message, not modal)       │
└─────────────────────────────────────────┘
```

## Security

- ✅ RLS policies prevent non-subscribed users from accessing data
- ✅ Database triggers block message creation without subscription
- ✅ Chat middleware checks usage before processing
- ✅ Modal provides UX layer on top of backend enforcement
- ✅ Admin role check done server-side for checkout sessions

## Testing

### Test Case 1: New Company Without Subscription
1. Create new company
2. Skip pricing in onboarding
3. Navigate to ClientDashboard
4. ✅ Modal should appear
5. Select plan and checkout
6. ✅ Modal should disappear after payment

### Test Case 2: Regular User in Unpaid Company
1. Admin creates company but doesn't subscribe
2. Admin invites regular user
3. Regular user logs in
4. ✅ Modal should appear
5. ✅ User should NOT be able to close modal
6. ✅ Admin subscribes
7. ✅ Modal should disappear for regular user automatically

### Test Case 3: Subscription Expiration
1. Company with active subscription
2. Simulate subscription cancellation/expiration
3. ✅ Modal should appear immediately for all users
4. Admin can reactivate via modal

## Future Enhancements

Potential improvements:
- Add grace period before blocking access
- Show trial countdown in modal
- Add "Contact Sales" button for enterprise inquiries
- Show previous plan details if subscription lapsed
- Add testimonials or feature highlights in modal

---

**Implementation Complete!** The subscription modal is now integrated into all user-facing pages and provides a seamless paywall experience. 🎉

