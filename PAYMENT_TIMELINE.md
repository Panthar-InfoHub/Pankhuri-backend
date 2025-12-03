# Payment Timeline - Visual Guide

## 📅 Paid Trial Timeline Example

### **Scenario: User starts ₹99/7-day trial for ₹999/month plan**

```
Day 1 (Dec 1, 10:00 AM)
│
├─ 10:00 AM: User clicks "Subscribe"
│  └─ POST /api/subscriptions → Returns order_id
│
├─ 10:02 AM: User completes ₹99 payment ✅
│  ├─ Razorpay sends order.paid webhook
│  ├─ Backend marks payment as "paid"
│  ├─ Backend creates subscription in Razorpay
│  └─ Backend creates subscription record (status: "pending")
│
├─ 10:03 AM: Razorpay activates subscription
│  ├─ Razorpay sends subscription.activated webhook
│  ├─ Backend calculates: trialEndsAt = Dec 1 10:02 AM + 7 days
│  └─ Backend updates: status: "trial", trialEndsAt: Dec 8 10:02 AM
│
└─ 🎉 User now in trial period (full access)

─────────────────────────────────────────────────────

Days 2-7 (Dec 2-7)
│
├─ User has full access to all content
├─ Frontend shows: "Trial ends in X days"
└─ No charges during this period

─────────────────────────────────────────────────────

Day 8 (Dec 8, 10:02 AM) - Trial Ends ⏰
│
├─ 10:02 AM: Trial period ends
│  ├─ Razorpay generates invoice for ₹999
│  └─ webhook: invoice.generated
│
├─ 10:02 AM: Razorpay attempts to charge ₹999
│  └─ webhook: subscription.charged
│
├─ SCENARIO A: Payment Succeeds ✅
│  ├─ webhook: invoice.paid
│  ├─ Backend updates: status: "active", isTrial: false
│  └─ User continues with full access (now paying customer)
│
└─ SCENARIO B: Payment Fails ❌
   ├─ webhook: payment.failed
   ├─ Backend updates: status: "past_due"
   ├─ Grace period starts (7 days)
   └─ User keeps access, but sees "Payment Failed" banner

─────────────────────────────────────────────────────

Days 9-15 (Dec 9-15) - Grace Period (if payment failed)
│
├─ Dec 10: Razorpay retry attempt #1
├─ Dec 12: Razorpay retry attempt #2
├─ Dec 14: Razorpay retry attempt #3
│
├─ IF any retry succeeds:
│  └─ Subscription becomes "active", user charged ₹999
│
└─ IF all retries fail:
   └─ Dec 15: Grace period ends
      ├─ Subscription → "halted" or "cancelled"
      └─ User loses access

─────────────────────────────────────────────────────

Day 38 (Jan 8, 10:02 AM) - Next Billing (if active)
│
└─ Razorpay charges ₹999 for next month
   └─ Same flow repeats every 30 days

```

---

## 📊 Key Dates Calculation

### **Trial End Date Formula:**

```javascript
trialEndsAt = paymentCompletedTimestamp + (trialDays * 24 hours)

Example:
Payment: Dec 1, 10:02:30 AM
Trial Days: 7
Trial Ends: Dec 8, 10:02:30 AM (exactly 7 days later)
```

### **Next Billing Date:**

```javascript
// For monthly plan
nextBillingAt = trialEndsAt + 30 days

// For yearly plan
nextBillingAt = trialEndsAt + 365 days
```

### **Grace Period End:**

```javascript
// Usually 7 days after payment failure
graceUntil = paymentFailedDate + 7 days
```

---

## 🎯 Important Timestamps in Database

### **UserSubscription Table:**

```
trialEndsAt         → When trial period ends (7 days from payment)
currentPeriodStart  → Start of current billing cycle
currentPeriodEnd    → End of current billing cycle
nextBillingAt       → When next charge happens
graceUntil          → Grace period end (only set if payment fails)
```

### **Payment Table:**

```
createdAt    → When payment record was created (used for trial calculation)
updatedAt    → Last update to payment
```

---

## 💡 Frontend Display Examples

### **Day 1 (Trial Active):**

```
┌─────────────────────────────────────────┐
│ 🎉 Trial Active                         │
│ 7 days remaining                        │
│ Next billing: ₹999 on Dec 8, 2025      │
└─────────────────────────────────────────┘
```

### **Day 6 (Trial Ending Soon):**

```
┌─────────────────────────────────────────┐
│ ⚠️ Trial ending in 2 days               │
│ Your card will be charged ₹999          │
│ on Dec 8, 2025                          │
│                                         │
│ [Cancel Subscription] [Update Card]    │
└─────────────────────────────────────────┘
```

### **Day 8 (Payment Failed):**

```
┌─────────────────────────────────────────┐
│ ❌ Payment Failed                        │
│ We couldn't charge your card            │
│ Update payment method to continue       │
│ Access ends on Dec 15, 2025            │
│                                         │
│ [Update Payment Method]                 │
└─────────────────────────────────────────┘
```

### **Day 8 (Payment Succeeded):**

```
┌─────────────────────────────────────────┐
│ ✅ Subscription Active                   │
│ Premium Plan - ₹999/month               │
│ Next billing: Jan 8, 2026               │
│                                         │
│ [Manage Subscription]                   │
└─────────────────────────────────────────┘
```

---

## 🔄 Webhook Processing Order

### **For Paid Trial Subscription:**

```
1. order.paid
   └─ Payment marked as paid
   └─ Subscription created in Razorpay
   └─ Subscription record created in DB

2. subscription.activated
   └─ Status → "trial"
   └─ trialEndsAt calculated from payment date
   └─ User gets access

3. invoice.generated (after 7 days)
   └─ Warning: charge coming soon

4. subscription.charged
   └─ Charge attempted

5a. invoice.paid (if success)
    └─ Status → "active"
    └─ isTrial → false

5b. payment.failed (if failure)
    └─ Status → "past_due"
    └─ Grace period starts
```

---

## 📱 Frontend Checklist

### **On App Load:**

- [ ] Call `GET /api/subscriptions/active`
- [ ] Check `status` field
- [ ] Check `isTrial` field
- [ ] Calculate days remaining if in trial
- [ ] Check `cancelAtPeriodEnd` flag

### **Display Logic:**

```javascript
// Trial Badge
if (status === "trial" && isTrial) {
  const daysLeft = Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000);
  show(`Trial: ${daysLeft} days left`);
}

// Payment Failed Banner
if (status === "past_due") {
  show("Payment Failed - Update Now");
}

// Active Badge
if (status === "active" && !isTrial) {
  show("Premium Member");
}

// Cancellation Notice
if (cancelAtPeriodEnd) {
  show(`Ending on ${currentPeriodEnd}`);
}
```

### **Access Control:**

```javascript
// Allow access if:
const hasAccess = ["trial", "active", "past_due"].includes(status);

// Block access if:
const blocked = ["cancelled", "expired", "halted"].includes(status);
```

---

## 🎬 Summary

**Trial Calculation:**
✅ Starts from payment date (when user paid ₹99)
✅ NOT from subscription creation or activation
✅ Calculated in webhook using payment.createdAt

**Grace Period:**
✅ 7 days buffer when recurring payment fails
✅ User keeps access during grace period
✅ Razorpay retries 3-4 times automatically
✅ Frontend shows "Update Payment" warning

**Automatic Billing:**
✅ All handled by Razorpay webhooks
✅ No cron jobs needed
✅ Backend just listens and updates database
