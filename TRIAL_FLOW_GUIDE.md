# Trial Subscription Flow - Complete Guide

## 📋 Overview

This document explains the complete trial subscription flow, what happens after 7 days, and what the frontend should check.

---

## ⏰ Important: Trial Period Calculation

**Trial starts from when user PAYS the trial fee (₹99), NOT from when subscription activates!**

### Example Timeline:

- **Dec 1, 10:00 AM** - User initiates subscription
- **Dec 1, 10:02 AM** - User completes ₹99 payment ✅ **Trial starts here**
- **Dec 1, 10:03 AM** - Razorpay activates subscription
- **Dec 8, 10:02 AM** - Trial ends (7 days from payment) ⏰
- **Dec 8, 10:02 AM** - Razorpay charges ₹999 for first month

**Key Point:** The 7 days are calculated from the `createdAt` timestamp of the paid trial payment record, ensuring users get exactly 7 days from when they paid!

---

## 🔄 Complete Trial Flow

### **Step 1: User Initiates Paid Trial Subscription**

**Frontend Action:**

```javascript
POST /api/subscriptions
Body: { "planId": "plan_id_here" }
```

**Response (Requires Payment):**

```json
{
  "success": true,
  "data": {
    "requiresPayment": true,
    "orderId": "order_xxxxx",
    "amount": 9900,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx"
  }
}
```

---

### **Step 2: User Completes Payment via Razorpay**

**Frontend Action:**

- Open Razorpay checkout with order details
- User pays ₹99 (or configured trial fee)

**What Happens:**

1. Razorpay processes payment
2. Sends `order.paid` webhook to backend
3. Backend marks payment as "paid"
4. Backend creates subscription in Razorpay
5. Backend creates subscription record in database with `status: "pending"`

---

### **Step 3: Razorpay Activates Subscription**

**What Happens:**

1. Razorpay sends `subscription.activated` webhook
2. Backend updates subscription:
   - `status: "trial"`
   - `isTrial: true`
   - `trialEndsAt: current_date + 7 days`
   - `currentPeriodStart: timestamp from Razorpay`
   - `currentPeriodEnd: timestamp from Razorpay`
   - `nextBillingAt: timestamp when trial ends`

---

### **Step 4: User Uses App During Trial (Days 1-7)**

**Frontend Should Check:**

```javascript
GET / api / subscriptions / active;
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub_123",
    "status": "trial",
    "isTrial": true,
    "trialEndsAt": "2025-12-09T00:00:00Z",
    "currentPeriodStart": "2025-12-02T00:00:00Z",
    "currentPeriodEnd": "2026-01-02T00:00:00Z",
    "nextBillingAt": "2025-12-09T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "plan": {
      "name": "Monthly Premium",
      "price": 99900,
      "currency": "INR"
    }
  }
}
```

**Frontend UI Logic:**

```javascript
// Check subscription status
if (subscription.status === "trial" && subscription.isTrial) {
  // User is in trial period
  const daysLeft = Math.ceil(
    (new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)
  );

  // Show banner: "Trial ends in 3 days"
  showTrialBanner(daysLeft);

  // Allow full access to content
  allowAccess = true;
}

// Check if trial is about to end (last 2 days)
if (daysLeft <= 2) {
  showReminderNotification(
    `Your trial ends in ${daysLeft} days. Your card will be charged ₹${
      subscription.plan.price / 100
    } on ${subscription.trialEndsAt}`
  );
}
```

---

### **Step 5: Trial Ends (After 7 Days)**

**What Happens Automatically:**

1. **Razorpay generates invoice** (Day 7)

   - Webhook: `invoice.generated`
   - Backend creates payment record with `status: "pending"`

2. **Razorpay charges the card** (Same day)

   - Webhook: `subscription.charged`
   - Backend creates/updates payment record
   - Updates subscription:
     - `status: "active"`
     - `isTrial: false` (trial converted to paid)
     - Updates billing dates

3. **Payment successful** (if card works)

   - Webhook: `invoice.paid`
   - Backend marks payment as "paid"
   - User continues with full access

4. **Payment failed** (if card declined)
   - Webhook: `payment.failed`
   - Backend updates subscription:
     - `status: "past_due"`
   - User enters grace period

---

### **Step 6: Post-Trial - Active Subscription**

**Frontend Should Check:**

```javascript
GET / api / subscriptions / active;
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "sub_123",
    "status": "active",
    "isTrial": false,
    "trialEndsAt": "2025-12-09T00:00:00Z",
    "currentPeriodStart": "2025-12-09T00:00:00Z",
    "currentPeriodEnd": "2026-01-09T00:00:00Z",
    "nextBillingAt": "2026-01-09T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "graceUntil": null
  }
}
```

**Frontend UI Logic:**

```javascript
if (subscription.status === "active" && !subscription.isTrial) {
  // User has active paid subscription
  const nextBilling = new Date(subscription.nextBillingAt);

  // Show: "Next billing on Jan 9, 2026 - ₹999"
  showNextBillingInfo(nextBilling, subscription.plan.price);

  // Full access
  allowAccess = true;
}
```

---

## 🛡️ What is Grace Period?

**Grace Period** is a safety net when recurring payments fail. It gives users time to fix their payment method without losing access immediately.

### How It Works:

1. **Payment Fails** (e.g., after trial ends)

   - Card declined, insufficient funds, expired card, etc.
   - Subscription status changes to `past_due`

2. **Razorpay Retry Logic** (Automatic)

   - **Day 1:** First attempt fails
   - **Day 3:** Razorpay retries automatically
   - **Day 5:** Another retry
   - **Day 7:** Final retry

3. **During Grace Period:**

   - User still has full access to content
   - `status: "past_due"`
   - `graceUntil: Date` (when grace ends)
   - Frontend shows "Payment Failed" banner

4. **After Grace Period:**
   - If payment still fails after all retries:
     - Subscription → `halted` or `cancelled`
     - User loses access
     - Must resubscribe

### Frontend Handling:

```javascript
if (subscription.status === "past_due") {
  const gracePeriodActive =
    subscription.graceUntil && new Date(subscription.graceUntil) > new Date();

  if (gracePeriodActive) {
    // Still in grace period - allow access but show warning
    allowAccess = true;
    showUrgentBanner({
      type: "error",
      message: "Payment failed! Update your payment method to avoid losing access.",
      action: "Update Payment",
      onClick: () => redirectToPaymentUpdate(),
    });
  } else {
    // Grace period expired
    allowAccess = false;
    showBlockedScreen({
      message: "Your subscription is inactive due to payment failure.",
      action: "Resubscribe",
    });
  }
}
```

**Why Grace Period Exists:**

- Temporary payment issues (bank downtime, daily limit reached)
- Expired cards (user needs time to update)
- Better user experience (not immediate cutoff)
- Higher retention (more chances to collect payment)

---

## 🚨 Handling Different Subscription States

### **1. Trial Active (`status: "trial"`)**

```javascript
// Frontend logic
const isTrialActive = subscription.status === "trial" && subscription.isTrial;
const trialEndsAt = new Date(subscription.trialEndsAt);
const now = new Date();

if (isTrialActive && trialEndsAt > now) {
  // User is in active trial
  allowAccess = true;
  showTrialBadge();
}
```

### **2. Active Subscription (`status: "active"`)**

```javascript
if (subscription.status === "active") {
  // User has paid subscription
  allowAccess = true;

  // Check if user scheduled cancellation
  if (subscription.cancelAtPeriodEnd) {
    const endsAt = new Date(subscription.currentPeriodEnd);
    showCancellationNotice(`Your subscription will end on ${endsAt}. Renew to continue access.`);
  }
}
```

### **3. Past Due (`status: "past_due"`)**

```javascript
if (subscription.status === "past_due") {
  // Payment failed, user in grace period
  const graceEnds = new Date(subscription.graceUntil);

  if (graceEnds > new Date()) {
    // Still in grace period
    allowAccess = true;
    showPaymentFailedBanner("Your payment failed. Please update your payment method.");
  } else {
    // Grace period expired
    allowAccess = false;
    redirectToPaymentUpdate();
  }
}
```

### **4. Cancelled (`status: "cancelled"`)**

```javascript
if (subscription.status === "cancelled") {
  allowAccess = false;
  showResubscribeOption();
}
```

### **5. Expired (`status: "expired"`)**

```javascript
if (subscription.status === "expired") {
  allowAccess = false;
  showRenewOption();
}
```

---

## 🎯 Key Fields to Check in Frontend

### **For Trial Users:**

- `status` - Should be "trial"
- `isTrial` - Should be `true`
- `trialEndsAt` - Date when trial ends
- `nextBillingAt` - When first charge happens (same as trialEndsAt)

### **For Active Users:**

- `status` - Should be "active"
- `isTrial` - Should be `false` (converted from trial)
- `currentPeriodEnd` - When current billing cycle ends
- `nextBillingAt` - When next charge happens
- `cancelAtPeriodEnd` - If user scheduled cancellation

### **For All Users:**

- `cancelAtPeriodEnd` - Important for showing "Subscription ending soon" message

---

## 💳 Recurring Payment Flow (After Trial)

### **Monthly Subscription:**

1. **Day 1-7:** Trial period (₹99 paid upfront)
2. **Day 7:** Trial ends, Razorpay charges ₹999
3. **Day 37:** Next billing, Razorpay charges ₹999
4. **Day 67:** Next billing, and so on...

### **What Webhooks Come:**

- `invoice.generated` - Before charging (warning)
- `subscription.charged` - When charge is attempted
- `invoice.paid` - When charge succeeds
- `payment.failed` - If charge fails

### **Backend Handles Automatically:**

- Creating payment records
- Updating subscription dates
- Managing grace periods
- Retry logic (Razorpay handles this)

---

## 🔧 Frontend API Calls Reference

### **1. Get Active Subscription**

```javascript
GET /api/subscriptions/active
Authorization: Bearer {token}

// Returns null if no active subscription
// Returns subscription object if exists
```

### **2. Get Subscription History**

```javascript
GET /api/subscriptions
Authorization: Bearer {token}

// Returns array of all user's subscriptions
```

### **3. Cancel at Period End**

```javascript
POST /api/subscriptions/{id}/cancel
Authorization: Bearer {token}

// Sets cancelAtPeriodEnd to true
// User keeps access until currentPeriodEnd
```

### **4. Cancel Immediately**

```javascript
POST /api/subscriptions/{id}/cancel-immediately
Authorization: Bearer {token}

// Immediately cancels subscription
// User loses access immediately
```

---

## 📊 Frontend Dashboard Example

```javascript
function SubscriptionDashboard({ subscription }) {
  if (!subscription) {
    return <NoSubscriptionView />;
  }

  const { status, isTrial, trialEndsAt, nextBillingAt, cancelAtPeriodEnd, plan } = subscription;

  // Calculate days remaining
  const daysUntilNextBilling = Math.ceil(
    (new Date(nextBillingAt) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div>
      {/* Trial Badge */}
      {isTrial && status === "trial" && (
        <Banner type="info">
          🎉 Trial Active - {daysUntilNextBilling} days remaining
          <br />
          Next billing: ₹{plan.price / 100} on {new Date(trialEndsAt).toLocaleDateString()}
        </Banner>
      )}

      {/* Active Subscription */}
      {status === "active" && !isTrial && (
        <Card>
          <h3>Active Subscription</h3>
          <p>Plan: {plan.name}</p>
          <p>Next billing: {new Date(nextBillingAt).toLocaleDateString()}</p>
          <p>Amount: ₹{plan.price / 100}</p>
        </Card>
      )}

      {/* Cancellation Notice */}
      {cancelAtPeriodEnd && (
        <Banner type="warning">
          Your subscription will end on{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </Banner>
      )}

      {/* Payment Failed */}
      {status === "past_due" && (
        <Banner type="error">
          Payment failed. Please update your payment method.
          <Button onClick={updatePaymentMethod}>Update Payment</Button>
        </Banner>
      )}

      {/* Actions */}
      {!cancelAtPeriodEnd && (
        <Button onClick={() => cancelSubscription(subscription.id)}>Cancel Subscription</Button>
      )}
    </div>
  );
}
```

---

## 🔍 Common Issues & Solutions

### **Issue: trialEndsAt is null**

**Cause:** Subscription not yet activated by Razorpay webhook
**Solution:** Wait for `subscription.activated` webhook (usually instant)

### **Issue: Payment fails after trial**

**Cause:** User's card declined or insufficient funds
**Solution:**

- Subscription goes to `past_due`
- Razorpay retries automatically (3-4 attempts over 7 days)
- User gets grace period to fix payment
- Show payment update prompt to user

**Grace Period Explained:**
When recurring payment fails (like after trial ends), Razorpay doesn't immediately block the user. Instead:

- Day 1: First charge attempt fails
- Days 2-7: Razorpay retries 3-4 times automatically
- During this time: `status: "past_due"`, but user still has access
- After grace period: If still failing, subscription goes to `halted` or `cancelled`
- Frontend should show "Payment Failed - Update Payment Method" banner

### **Issue: User wants to cancel during trial**

**Cause:** User doesn't want to continue
**Solution:**

- Call cancel endpoint
- Razorpay cancels subscription
- No charge at trial end

---

## 🎉 Summary

### **What Backend Handles Automatically:**

✅ Payment processing via webhooks
✅ Subscription activation
✅ Trial period calculation
✅ Recurring billing
✅ Payment retries
✅ Grace periods
✅ Status updates

### **What Frontend Should Do:**

✅ Check subscription status on app load
✅ Show trial countdown
✅ Display next billing date
✅ Handle payment failed states
✅ Show cancellation options
✅ Redirect to payment update if needed

The key is to regularly check `GET /api/subscriptions/active` and handle all possible subscription states in your UI! 🚀
