# 💰 Comprehensive Payment & Subscription Testing Guide

This document outlines the end-to-end testing strategy for the Panthar LMS payment and access system. It covers all edge cases, hierarchical logic, and lifecycle transitions.

---

## 🏗️ 1. Plan Management (Admin)

### 1.1 Integrity Checks
- [ ] **Course Requirement**: Try creating a `COURSE` plan with `subscriptionType: "monthly"`.
    - **Expected**: Failure. Courses only support `lifetime`.
- [ ] **Uniqueness Constraint**: Create a `WHOLE_APP` yearly plan. Try to create another one while the first is `isActive: true`.
    - **Expected**: Failure (unless `deactivateOthers: true` is sent).
- [ ] **Immutable Fields**: Try to `PUT` a new `price` or `planType` to an existing plan ID.
    - **Expected**: Strict Error. System should prevent billing changes to maintain subscriber integrity.

### 1.2 Deprecation (Price Change)
- [ ] **The "Replace" Flow**: Create Plan A ($99). Create Plan B ($149) with `deactivateOthers: true`.
    - **Expected**: Plan A becomes `isActive: false`. Plan B becomes the new active plan.
    - **Sub-test**: Verify old users of Plan A are still billed $99 on their next cycle (if recurring).

---

## 🛡️ 2. Hierarchical Purchase Protection

This is the "Smart Access" logic to prevent redundant spending.

### 2.1 The "God Mode" Check
- [ ] **Whole App Entitlement**: Grant user `WHOLE_APP` access. Try to initiate a subscription for a random `CATEGORY`.
    - **Expected**: Blocked. "You already have full app access."

### 2.2 Parent → Child Protection
- [ ] **Ancestor Ownership**: User buys "Design Category" (Parent). Try to buy "UI/UX Masterclass" (Child Course inside that category).
    - **Expected**: Blocked. "You already have access via a parent category."
- [ ] **Deep Hierarchy**: User buys Grandparent Category -> Try to buy Grandchild Category.
    - **Expected**: Blocked.

### 2.3 Direct Overlap
- [ ] **Double Purchase**: Try to buy the same `COURSE` twice while the first entitlement is still active.
    - **Expected**: Blocked. "Already purchased."

---

## ⏱️ 3. Trial & Lifecycle Management

### 3.1 One Trial Per User
- [ ] **Free Trial Usage**: Start a trial for Category A. Cancel it. Try to start a trial for Category B or Whole App.
    - **Expected**: Blocked. `hasUsedTrial` flag should prevent repeated trials across different plans.
- [ ] **Paid Trials**: Initiate a plan with `trialFee: 500`. 
    - **Expected**: Returns a Razorpay `orderId` for the upfront fee before moving to the subscription.

### 3.2 Cancellation States
- [ ] **Cancel at Period End**: Cancel an active subscription.
    - **Expected**: `cancelAtPeriodEnd` = true. Entitlement remains `active` until `validUntil`.
- [ ] **Immediate Cancellation**: Admin cancels user immediately.
    - **Expected**: Entitlement status becomes `revoked`/`expired` immediately. Razorpay subscription status = `cancelled`.

---

## ⚡ 4. Webhook & Background Processing

### 4.1 Payment Captured (One-time)
- [ ] Simulation: Trigger `payment.captured` for a Course order.
    - **Expected**: `UserSubscription` becomes `active`, `UserEntitlement` is granted with `validUntil: null`.

### 4.2 Subscription Lifecycle
- [ ] **Successful Authentication**: User pays for sub. Trigger WEBHOOK.
    - **Expected**: Sub becomes `active`. Entitlement granted.
- [ ] **Payment Failure**: Simulate `invoice.payment_failed`.
    - **Expected**: Subscription becomes `past_due`. User retains grace period access (if configured).

### 4.3 Redundant Cleanup
- [ ] **The "Bundle Upgrade"**: User has a Monthly Category Sub. They buy the Yearly Whole App Plan.
    - **Expected**: After successful purchase, the system should automatically cancel the smaller Monthly Category sub to stop double-billing.

---

## 🏢 5. Cascade Deletions (Critical)

- [ ] **Course Deletion**: Delete a course that has an active plan.
    - **Expected**: Plan should be deactivated/deleted. Any recurring subscriptions for that course (if any) should be cancelled.
- [ ] **Category Deletion**: Delete parent category.
    - **Expected**: Should cascade deactivate children's plans to prevent "Ghost Subscriptions" where users pay for non-existent content.

---

## 🌟 6. UX & Better Outcomes

### 6.1 Frontend Best Practices
1.  **Redirecting Pending Users**: If `GET /status` returns a `pending` subscription, do not show the "Buy" button. Show "Finish Payment" or "Cancel Pending" to avoid order clutter.
2.  **Trial Clarity**: Clearly show "Valid for 7 days" before the user clicks pay.
3.  **Grandfathering UI**: If a price changes, show the old user "You are on a Legacy Plan" so they know they are getting a better deal.

### 6.2 Error Messaging
- [ ] **Gateway Failures**: If Razorpay is down during plan creation, the DB record must rollback (Atomic Transaction).
- [ ] **Expired Access**: When a user clicks a video, if access is expired, redirect to the exact Plan Page for that video's category.

---

## 🧪 How to run these tests?
1.  **Postman**: Use the "Panlhuri Backend New API" collection (Plans & Subscriptions folder).
2.  **Razorpay Webhook CLI**: Use `razorpay-cli` to trigger events like `subscription.activated`.
3.  **Manual DB**: Check the `hasUsedTrial` boolean and `UserEntitlement` tables after every action.
