# Payment Gateway Agnostic Subscription System

A complete subscription management system with generic naming conventions, making it easy to swap payment providers without changing business logic.

## 🎯 Features

- ✅ **Gateway Agnostic**: Generic field names (not `razorpayPlanId`, but `planId`)
- ✅ **Backend-Only Logic**: All financial logic lives in backend
- ✅ **Simple Frontend**: Frontend sends only `planSlug` - backend determines everything
- ✅ **Easy to Swap**: Change payment gateway by updating environment variables
- ✅ **Clean Architecture**: Routes → Controllers → Services pattern
- ✅ **Webhook Processing**: Idempotent webhook handlers
- ✅ **Trial Support**: Both free and paid trials
- ✅ **Grace Period**: 7-day grace period for failed payments
- ✅ **Background Jobs**: Auto-expire trials and grace periods

## 📊 Database Models

### SubscriptionPlan
- Stores plan details (price, billing interval, trial config)
- Links to payment gateway via `planId` (generic name)
- Created in DB first, then synced to gateway

### UserSubscription
- Tracks user's subscription lifecycle
- Status: `pending`, `trial`, `active`, `past_due`, `cancelled`, `halted`, `expired`
- Links to gateway via `subscriptionId` (generic name)

### Payment
- Records all transactions
- Types: `trial`, `recurring`, `one_time`
- Webhook idempotency tracking

## 🔄 User Flows

### Flow 1: Free Trial Subscription
1. Frontend sends `{ planSlug: "premium-monthly" }`
2. Backend creates subscription in gateway
3. Backend stores subscription with `status: pending`, `isTrial: true`
4. Gateway webhook `subscription.activated` → status becomes `trial`
5. Trial ends → Gateway auto-charges
6. Gateway webhook `invoice.paid` → status becomes `active`

### Flow 2: Paid Trial Subscription
1. Frontend sends `{ planSlug: "premium-monthly" }`
2. Backend sees `isPaidTrial: true`, creates payment order
3. Backend returns `{ requiresPayment: true, orderId, amount, keyId }`
4. Frontend shows checkout, user pays
5. Frontend sends `{ orderId, paymentId, signature }` to verify
6. Backend verifies signature, creates subscription
7. Gateway webhook `subscription.activated` → status becomes `trial`

### Flow 3: Payment Failure & Grace Period
1. Gateway fails to charge → webhook `invoice.payment_failed`
2. Backend sets `status: past_due`, `graceUntil: now + 7 days`
3. Gateway retries payment automatically
4. **Success**: webhook `invoice.paid` → status back to `active`
5. **Failure**: Grace period expires → background job sets `status: halted`

### Flow 4: Cancellation
- **At Period End**: `cancelAtPeriodEnd: true`, user keeps access until end
- **Immediately**: `status: cancelled`, access revoked now

## 🚀 Setup Instructions

### 1. Environment Variables

Add to `.env`:

```env
# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Run Database Migration

```bash
npx prisma migrate dev --name add_subscription_system
```

### 4. Start Server

```bash
npm run dev
```

## 📡 API Endpoints

### Plans

```
GET    /api/plans                    # Get all active plans (public)
GET    /api/plans/slug/:slug         # Get plan by slug (public)
POST   /api/plans                    # Create plan (admin)
PUT    /api/plans/:id                # Update plan (admin)
DELETE /api/plans/:id                # Delete plan (admin)
POST   /api/plans/:id/sync           # Sync plan to gateway (admin)
```

### Subscriptions

```
POST   /api/subscriptions                        # Initiate subscription
POST   /api/subscriptions/verify-trial-payment   # Verify paid trial
GET    /api/subscriptions/active                 # Get active subscription
GET    /api/subscriptions                        # Get subscription history
GET    /api/subscriptions/:id                    # Get subscription by ID
POST   /api/subscriptions/:id/cancel             # Cancel at period end
POST   /api/subscriptions/:id/cancel-immediately # Cancel immediately
POST   /api/subscriptions/:id/sync               # Sync from gateway (admin)
```

### Webhooks

```
POST   /api/webhooks/payment         # Payment gateway webhooks
```

## 🎯 Usage Examples

### Create a Plan (Admin)

```bash
POST /api/plans
{
  "name": "Premium Monthly",
  "slug": "premium-monthly",
  "subscriptionType": "monthly",
  "price": 49900,
  "currency": "INR",
  "billingInterval": "monthly",
  "trialDays": 7,
  "isPaidTrial": false,
  "features": {
    "courses": "unlimited",
    "support": "priority"
  }
}
```

### Subscribe to Plan (User)

```bash
POST /api/subscriptions
Authorization: Bearer <token>
{
  "planSlug": "premium-monthly"
}
```

**Response for Free Trial:**
```json
{
  "success": true,
  "message": "Subscription initiated successfully",
  "data": {
    "requiresPayment": false,
    "subscription": { ... }
  }
}
```

**Response for Paid Trial:**
```json
{
  "success": true,
  "message": "Payment required for trial",
  "data": {
    "requiresPayment": true,
    "orderId": "order_abc123",
    "amount": 9900,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

### Verify Paid Trial Payment

```bash
POST /api/subscriptions/verify-trial-payment
Authorization: Bearer <token>
{
  "orderId": "order_abc123",
  "paymentId": "pay_xyz789",
  "signature": "signature_from_razorpay"
}
```

### Cancel Subscription

```bash
POST /api/subscriptions/:id/cancel
Authorization: Bearer <token>
```

## 🔌 Webhook Events Handled

- `subscription.activated` - Subscription started
- `order.paid` - Paid trial completed
- `invoice.generated` - Invoice created
- `invoice.paid` - Payment successful
- `invoice.payment_failed` - Payment failed
- `subscription.cancelled` - Subscription cancelled
- `subscription.halted` - Subscription stopped after retries
- `subscription.charged` - Recurring payment successful

## 🛠️ Background Jobs

### Expire Trial Subscriptions
Run daily to check for expired trials:
```typescript
import { expireTrialSubscriptions } from "@/services/subscription.service";
await expireTrialSubscriptions();
```

### Expire Grace Periods
Run daily to halt subscriptions after grace period:
```typescript
import { expireGracePeriods } from "@/services/subscription.service";
await expireGracePeriods();
```

### Cleanup Abandoned Orders
Run daily to mark old pending orders as failed:
```typescript
import { cleanupAbandonedOrders } from "@/services/payment.service";
await cleanupAbandonedOrders();
```

### Reconcile Payments
Run daily to sync payment status with gateway:
```typescript
import { reconcilePayments } from "@/services/payment.service";
await reconcilePayments();
```

## 🔄 Swapping Payment Gateways

To swap from Razorpay to another provider:

1. Update `src/lib/payment-gateway.ts` with new provider's API
2. Keep function signatures the same (generic names)
3. Update environment variables
4. No changes needed in services, controllers, or routes!

## 🎓 Key Principles

1. **Gateway Agnostic** - Easy to switch providers
2. **Backend Controls All** - Frontend is just UI
3. **Idempotent Everything** - Safe for retries
4. **Generic Naming** - No vendor lock-in
5. **Webhook Driven** - Events update state
6. **Grace Period Strategy** - Give users time to fix payment
7. **Clean Architecture** - Services → Controllers → Routes

## 📝 Notes

- Plans cannot have price updated (create new plan instead to preserve existing subscriptions)
- Webhooks are processed asynchronously to return 200 immediately
- All webhook handlers check idempotency to prevent duplicate processing
- Payment signatures are verified before processing
- User can only have one active subscription at a time

## 🔒 Security

- Webhook signatures verified before processing
- Payment signatures verified before confirming
- User ownership checked for subscription operations
- Admin-only endpoints protected with authentication middleware

## 📚 Architecture

```
Frontend
    ↓ (sends only planSlug)
Routes Layer
    ↓
Controllers Layer (validation, formatting)
    ↓
Services Layer (business logic)
    ↓
Payment Gateway Utility (generic wrapper)
    ↓
Payment Provider (Razorpay/Stripe/etc.)
```

## ✅ Success Criteria

- [x] Plans created via backend API
- [x] Frontend sends only `planSlug`
- [x] All pricing logic in backend
- [x] Webhooks process idempotently
- [x] Can swap gateways via config
- [x] No gateway-specific names in DB
- [x] Edge cases handled
- [x] Background jobs implemented
- [x] Clean architecture followed
