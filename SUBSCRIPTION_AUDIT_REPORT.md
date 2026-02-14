# 🔍 Subscription & Access Flow — Full Audit Report

**Date:** 2026-02-14  
**Scope:** Subscription initiation, payment, webhook processing, entitlement granting/revoking, access control, cancellation, upgrades, nested categories, and edge cases.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Critical Bugs](#2-critical-bugs)
3. [High-Priority Edge Cases](#3-high-priority-edge-cases)
4. [Medium-Priority Issues](#4-medium-priority-issues)
5. [Low-Priority / Future Issues](#5-low-priority--future-issues)
6. [Flow-by-Flow Analysis](#6-flow-by-flow-analysis)
7. [Entitlement Calculation Audit](#7-entitlement-calculation-audit)
8. [Recommendations Summary](#8-recommendations-summary)

---

## 1. Architecture Overview

Your system has **4 layers**:

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **SubscriptionPlan** | Admin-defined plans (WHOLE_APP, CATEGORY, COURSE) | `plan.service.ts` |
| **UserSubscription** | Tracks user's active plan-subscription lifecycle | `subscription.service.ts` |
| **Payment** | Records every payment event (trial, recurring, one_time) | `payment.service.ts`, `webhook.service.ts` |
| **UserEntitlement** | Fast access-control lookup table (the "truth" for has-access) | `entitlement.service.ts` |

**Flow:** `User Pays → Webhook → Subscription Updated → Entitlement Synced → Access Granted`

---

## 2. Critical Bugs 🚨

### BUG-1: Entitlement NOT revoked on `subscription.cancelled` webhook

**File:** `webhook.service.ts` → `handleSubscriptionCancelled` (line 399-418)

**Problem:** When a subscription is cancelled (via webhook), the subscription status is set to `"cancelled"` but the **entitlement is NEVER revoked**. Compare with `handleSubscriptionHalted` which correctly calls `revokeEntitlement()`.

**Impact:** Users who cancel their subscription **keep permanent access** to all content. This is a revenue-critical bug.

**Fix needed:**
```typescript
// In handleSubscriptionCancelled, add:
if (subscription.plan) {
    await revokeEntitlement(subscription.userId, subscription.plan.planType, subscription.plan.targetId);
}
```

**Caveat:** For `cancelAtPeriodEnd`, you should NOT revoke immediately — only revoke when the period actually ends. You need to distinguish between **immediate cancellation** and **cancel-at-period-end** in the webhook.

---

### BUG-2: Entitlement NOT revoked on `cancelImmediately()` service call

**File:** `subscription.service.ts` → `cancelImmediately` (line 504-540)

**Problem:** When a user cancels immediately via your API, the subscription status is set to `"cancelled"` and `currentPeriodEnd` is set to `new Date()`, but **entitlement is never revoked**. The user retains full access.

**Impact:** Same as BUG-1 — users keep access after immediate cancellation.

---

### BUG-3: `cancelAtPeriodEnd` never actually revokes access at period end

**File:** `subscription.service.ts` → `cancelAtPeriodEnd` (line 464-499)

**Problem:** This sets `cancelAtPeriodEnd: true` in the DB and in the gateway. But there is **no background job or webhook handler** that checks for subscriptions where `cancelAtPeriodEnd === true` and `currentPeriodEnd <= now()` to revoke the entitlement.

**Result:** After the billing period ends, Razorpay fires `subscription.cancelled`, but as noted in BUG-1, the entitlement is never revoked there either.

**Fix needed:** Either:
- Fix BUG-1 to revoke entitlements on `subscription.cancelled` webhook, OR
- Add a background job that scans for expired `cancelAtPeriodEnd` subscriptions and revokes their entitlements.

---

### BUG-4: RTDN (Google Play) handlers receive wrong payload format

**File:** `webhook.service.ts` → `processRTDN` (line 609-634)

**Problem:** The RTDN notification handler maps notification types to the same webhook handlers used for Razorpay (e.g., `handleSubscriptionActivated`, `handleSubscriptionCancelled`). However, these handlers expect the Razorpay payload structure (`payload.payload.subscription.entity`), while Google Play RTDN sends a completely different structure. The handlers will crash with `Cannot read property 'entity' of undefined`.

**Impact:** All Google Play real-time notifications (renewal, cancellation, etc.) silently fail.

---

### BUG-5: `verifyWebhookSignature` uses `JSON.stringify(req.body)` instead of raw body

**File:** `webhook.controller.ts` (line 35)

**Problem:** The raw body for signature verification is constructed via `const rawBody = JSON.stringify(req.body)`. But Express may parse the JSON differently from the original request body (e.g., different key ordering, whitespace handling). Razorpay computes the HMAC on the **exact raw bytes** sent. Re-serializing with `JSON.stringify` can produce a different string, causing valid webhooks to fail signature verification.

**Impact:** Some legitimate webhooks may be rejected, causing missed payments and entitlement grants.

**Fix needed:** Use `express.raw()` middleware or capture the raw body before JSON parsing for webhook routes.

---

## 3. High-Priority Edge Cases 🔶

### EDGE-1: Lifetime purchases don't set `validUntil` on entitlement — but `syncSubscriptionToEntitlement` does

**Problem:** When a lifetime plan payment is captured (`handlePaymentCaptured`, line 551-559), it calls `grantEntitlement` WITHOUT a `validUntil` date (correct — lifetime should be permanent). However, `syncSubscriptionToEntitlement` (called elsewhere) sets `validUntil: sub.currentPeriodEnd || undefined`. For lifetime subscriptions, `currentPeriodEnd` is never set, so `validUntil` ends up as `undefined` — which works. **BUT** if someone later adds a `currentPeriodEnd` to a lifetime subscription record accidentally, it will expire the entitlement.

**Suggestion:** Add an explicit guard in `syncSubscriptionToEntitlement`:
```typescript
if (sub.plan.subscriptionType === 'lifetime') {
    validUntil = undefined; // Always null for lifetime
}
```

---

### EDGE-2: User buys CATEGORY, then buys a child COURSE inside it — no overlap check for children

**File:** `subscription.service.ts` → `initiateSubscription` (line 67-95)

**Problem:** The overlap check when buying a COURSE only checks if the user has a **CATEGORY entitlement that is an ancestor** of the course's category. But if the user already owns the CATEGORY itself (not an ancestor), the check at line 75 uses `catAncestors` which INCLUDES the course's own category. This is **correct** — `getCategoryAncestors` returns `[self, parent, grandparent, ...]`.

✅ This works correctly for course → category ancestor check.

**However**, there is a **missing reverse check**: If a user has individual COURSE entitlements for courses within a category, and then tries to buy the parent CATEGORY, nothing warns them that they already own some courses in it (no partial overlap warning). This isn't a bug but could confuse users who paid for individual courses and then pay for the whole category.

**Suggestion:** Add a notification/warning (not a block) when buying a category if user already owns individual courses within it.

---

### EDGE-3: `cleanupRedundantSubscriptions` only checks direct `categoryId`, misses nested hierarchy

**File:** `subscription.service.ts` → `cleanupRedundantSubscriptions` (line 805-814)

**Problem:** When checking if a COURSE subscription is redundant after buying a CATEGORY:
```typescript
if (course?.categoryId === targetId) {
    isRedundant = true;
}
```
This only checks the **direct** category match. If user buys a top-level CATEGORY, courses in **child categories** are NOT marked as redundant.

**Example:** Category hierarchy: `Tech → Web Dev → React`. User buys `Tech`. Course `React Basics` in `React` subcategory is NOT cleaned up, even though the `Tech` category entitlement covers it.

**Fix needed:** Use the `getCategoryAncestors` pattern to check if the course's category is a descendant of the purchased category.

---

### EDGE-4: `hasUsedTrial` is global, not per-plan

**File:** `user.prisma` → `hasUsedTrial: Boolean @default(false)`

**Problem:** `hasUsedTrial` is a single boolean on the `User` model. Once a user takes a trial for ANY plan, they can never get a trial for ANY other plan. This may be intentional, but it's a significant business decision.

**Example:** User takes a trial for "Web Dev Monthly", then wants to try "Data Science Monthly" — they can't get a trial because `hasUsedTrial` is globally `true`.

**If intentional:** Document this as a business rule.  
**If not intentional:** Track trial usage per plan or per plan type.

---

### EDGE-5: Race condition — Concurrent subscription initiations

**Problem:** There's no locking mechanism in `initiateSubscription`. If two requests come in simultaneously:
1. Both check for existing entitlements → both see none
2. Both check for existing subscriptions → both see none
3. Both create new subscriptions and gateway subscriptions

**Impact:** User ends up with duplicate subscriptions on Razorpay and duplicate `UserSubscription` records.

**Mitigation:** The `@@unique([userId, planId])` constraint on `UserSubscription` with the `upsert` calls partially prevents this. However, the `findFirst` check at line 166 is still vulnerable to a TOCTOU (time-of-check-time-of-use) race.

**Suggestion:** Use a database advisory lock or a distributed lock (e.g., Redis) for subscription initiation.

---

### EDGE-6: No background jobs are configured

**Problem:** The codebase defines several important background job functions:
- `expireTrialSubscriptions()` — moves trial → active
- `expireGracePeriods()` — moves past_due → halted
- `reconcilePayments()` — syncs pending payments with gateway (currently a TODO)
- `cleanupAbandonedOrders()` — marks old pending payments as failed

**But NONE of these are called anywhere.** There are no cron jobs, no `setInterval`, no scheduler config.

**Impact:**
- Trial subscriptions **never** transition to active status via background jobs (they rely entirely on webhooks)
- Grace periods **never** expire → users with failed payments keep `past_due` status forever and retain access indefinitely
- Abandoned payment records accumulate forever

**Fix needed:** Set up a cron/scheduler (e.g., `node-cron`, Cloud Scheduler) to run these periodically:
```
- expireTrialSubscriptions: every hour
- expireGracePeriods: every hour
- cleanupAbandonedOrders: every 6 hours
- reconcilePayments: every hour (once implemented)
```

---

### EDGE-7: `payment.captured` webhook could grant double entitlement

**File:** `webhook.service.ts` → `handlePaymentCaptured` (line 502-580)

**Problem:** Both `handlePaymentCaptured` (webhook) **and** `verifyCoursePurchase` (manual verification in `purchase.service.ts`) can fire for the same payment. Both will call `grantEntitlement`. While `grantEntitlement` uses `upsert`, the `cleanupRedundantSubscriptions` runs twice, which is inefficient and could cause race conditions with gateway cancellation.

The `handlePaymentCaptured` webhook has an idempotency check (`if (payment.status === "paid")`) which helps, but if `verifyCoursePurchase` runs first, the webhook will skip the idempotency check because it looks up payment by `orderId`, not status.

**Suggestion:** Add a similar idempotency check in `verifyCoursePurchase` or ensure the webhook is the single source of truth for payment confirmation.

---

## 4. Medium-Priority Issues 🟡

### MED-1: `purchase.service.ts` bypasses overlap checks for category coverage

**File:** `purchase.service.ts` → `initiateCoursePurchase` (line 16-35)

**Problem:** When buying an individual course, the overlap check only verifies:
- WHOLE_APP entitlement
- Direct COURSE entitlement

**Missing:** It does NOT check if the user has a CATEGORY entitlement that already covers this course. A user with a category subscription could buy (and pay for) an individual course they already have access to.

**Fix:** Add category hierarchy check like in `initiateSubscription`.

---

### MED-2: `cancelPendingSubscription` cancels ALL pending subscriptions without gateway cleanup

**File:** `subscription.service.ts` → `cancelPendingSubscription` (line 620-635)

**Problem:** This function cancels all pending subscriptions for a user using `updateMany`, but it does NOT cancel the corresponding Razorpay subscriptions. The gateway subscriptions remain active and could potentially charge the user.

**Compare with:** `cancelPendingSubscriptionById` also doesn't do gateway cleanup. Only the pending-cleanup logic inside `initiateSubscription` (line 179-209) properly cancels the gateway subscription.

---

### MED-3: Entitlement `targetId` uses empty string `""` for WHOLE_APP instead of `null`

**File:** `entitlement.service.ts` → `grantEntitlement` (line 40)

**Problem:** `targetId: targetId || ""` — When granting WHOLE_APP entitlement, `targetId` is `null`, so it gets stored as `""`. The unique constraint `@@unique([userId, type, targetId])` will use `""`. This works but is inconsistent — the `SubscriptionPlan` model stores `targetId` as `null` for WHOLE_APP plans. When you compare these later (e.g., in `revokeEntitlement`), passing `null` creates a mismatch with `""` in the DB.

**Potential bug:** `revokeEntitlement(userId, "WHOLE_APP", null)` calls the upsert with `targetId: null || "" = ""`, which works. But any manual query or new code using `null` won't match.

---

### MED-4: `UserSubscription` has `@@unique([userId, planId])` — limits re-subscriptions

**Problem:** The unique constraint means a user can only ever have ONE subscription record per plan. The code uses `upsert` which reuses the old record. But this means:
- After a cancelled subscription, re-subscribing **reuses** the same record (updating status back to pending)
- Historical data is overwritten — you lose the original subscription dates, trial info, etc.

**Impact:** You can't tell how many times a user has subscribed/unsubscribed from a plan. The `payments` table still keeps history, but the subscription record itself is lossy.

**Suggestion:** Consider allowing multiple subscription records (remove the unique constraint) and use filtering for "current active" instead.

---

### MED-5: `getUserActiveSubscription` returns only FIRST active subscription

**File:** `subscription.service.ts` → `getUserActiveSubscription` (line 402-419)

**Problem:** Uses `findFirst` — returns only one subscription. But a user can have **multiple** active subscriptions (e.g., one for CATEGORY A, one for COURSE B). This function is misleading — it returns whichever was created most recently, ignoring others.

**Impact:** If the frontend relies on this to show subscription status, it only shows one.

---

### MED-6: `getUserAccessInfo` only returns first subscription, ignores entitlements

**File:** `subscription.service.ts` → `getUserAccessInfo` (line 690-721)

**Problem:** Similar to MED-5, returns only one subscription and doesn't check entitlements. Since entitlements are the real source of truth for access, this function can give misleading results (e.g., user has access via a one-time purchase but this function says no subscription).

---

### MED-7: Category children are fetched only 2 levels deep

**File:** `category.service.ts` → `getAllCategories` (line 139-149)

```typescript
include: {
    children: {
        include: { children: true },  // Only 2 levels deep
        orderBy: { sequence: "asc" }
    },
}
```

**Impact:** If your category hierarchy goes 3+ levels deep, the `attachPricingToCategories` recursive mapper will miss the inner-most children, and they won't get pricing/access info attached.

---

### MED-8: `expireTrialSubscriptions` transitions trial → active without entitlement sync

**File:** `subscription.service.ts` → `expireTrialSubscriptions` (line 547-561)

**Problem:** When a trial expires, the subscription status changes from `"trial"` to `"active"`, but `syncSubscriptionToEntitlement` is NOT called. While the entitlement already exists, the transition might need to update `validUntil` or other fields to reflect the new billing period.

---

## 5. Low-Priority / Future Issues 🟢

### LOW-1: No refund handling
There is no `payment.refunded` or `refund` webhook handler. If a refund is issued via Razorpay dashboard, entry will not be revoked.

### LOW-2: No email/notification on subscription events
No notification is sent when a subscription is activated, cancelled, or payment fails. Users may not know their access has changed.

### LOW-3: `reconcilePayments` is a stub (TODO)
The function exists but doesn't actually query the gateway. Pending payments older than 1 hour just get logged.

### LOW-4: No audit trail for entitlement changes
When an entitlement is granted, revoked, or expires, there's no log/audit table. You can't trace WHY a user has/lost access.

### LOW-5: `handleInvoiceGenerated` can create duplicate payment records
If Razorpay sends the `invoice.generated` webhook twice (retry), two payment records are created. There's no idempotency check.

### LOW-6: No rate limiting on subscription initiation
A malicious user could spam the `POST /api/subscriptions` endpoint, creating many Razorpay subscriptions. Each creation likely costs a small API fee or clutters your gateway dashboard.

### LOW-7: `price <= 0` check in `initiateSubscription` blocks free plan subscriptions
If you ever want to offer a ₹0 plan (fully free with registration), the check at line 98-100 blocks it. This may or may not be intentional.

### LOW-8: No Razorpay subscription pause/resume support
Razorpay supports pausing/resuming subscriptions, but your system has no handler for it.

### LOW-9: Google Play acknowledgement timing
In `handleGooglePlaySubscriptionCreate`, the purchase is acknowledged AFTER `initiateSubscription`. If `initiateSubscription` fails (e.g., overlap check), the purchase is never acknowledged. Google Play will auto-refund after 3 days.

---

## 6. Flow-by-Flow Analysis

### Flow 1: User Buys Recurring Subscription (Razorpay)

| Step | Status | Notes |
|------|--------|-------|
| 1. `initiateSubscription` called | ✅ | Overlap checks work correctly for most cases |
| 2. Razorpay subscription created | ✅ | Correct plan ID, trial config, addons |
| 3. `UserSubscription` record created (pending) | ✅ | Uses upsert with userId_planId |
| 4. User pays via Razorpay checkout | ✅ | External |
| 5. `subscription.authenticated` webhook (paid trial) | ✅ | Sets status to trial, syncs entitlement |
| 6. `subscription.activated` webhook | ✅ | Handles both trial and direct correctly |
| 7. Entitlement granted | ✅ | Via `syncSubscriptionToEntitlement` |
| 8. User gains access | ✅ | `hasAccess()` checks entitlements |
| 9. Recurring charge | ✅ | `subscription.charged` creates payment + syncs entitlement |
| 10. Failed payment → grace period | ✅ | 7-day grace via `invoice.payment_failed` |
| 11. Cancellation | ❌ **BUG** | Entitlement NOT revoked (BUG-1, BUG-2, BUG-3) |

### Flow 2: User Buys Lifetime Plan (One-time via Subscription Service)

| Step | Status | Notes |
|------|--------|-------|
| 1. `initiateSubscription` with lifetime plan | ✅ | Creates Razorpay order (not subscription) |
| 2. Payment captured via webhook | ✅ | `handlePaymentCaptured` grants entitlement |
| 3. Entitlement with no `validUntil` | ✅ | Lifetime access |
| 4. Clean up redundant subscriptions | ✅ | Works for direct target match |

### Flow 3: User Buys Individual Course (Purchase Service)

| Step | Status | Notes |
|------|--------|-------|
| 1. `initiateCoursePurchase` | ⚠️ | Missing category overlap check (MED-1) |
| 2. Razorpay order created | ✅ | Correct |
| 3. `verifyCoursePurchase` (manual verify) | ✅ | Signature verified, entitlement granted atomically |
| 4. `handlePaymentCaptured` (webhook backup) | ⚠️ | Could double-process (EDGE-7) |

### Flow 4: User Cancels Subscription

| Step | Status | Notes |
|------|--------|-------|
| Cancel at period end | ❌ **BUG** | Entitlement never revoked when period ends (BUG-3) |
| Cancel immediately | ❌ **BUG** | Entitlement never revoked (BUG-2) |
| Cancel pending | ⚠️ | Gateway subscription not cancelled (MED-2) |

### Flow 5: Upgrade (Buy Higher-Tier Plan)

| Step | Status | Notes |
|------|--------|-------|
| Buy CATEGORY when have COURSE | ⚠️ | Works, but redundant course subs only cleaned for direct category match (EDGE-3) |
| Buy WHOLE_APP when have CATEGORY | ✅ | All lower subs marked cancelAtPeriodEnd |
| Buy COURSE when have CATEGORY | ✅ | Correctly blocked with error message |

### Flow 6: Google Play Subscription

| Step | Status | Notes |
|------|--------|-------|
| Initial purchase | ✅ | Verified via Google API, entitlement synced |
| RTDN webhook for renewal/cancel | ❌ **BUG** | Wrong payload format (BUG-4) |
| Acknowledgement | ⚠️ | Timing issue (LOW-9) |

---

## 7. Entitlement Calculation Audit

### `hasAccess()` function review (entitlement.service.ts)

| Check | Status | Notes |
|-------|--------|-------|
| Free resource detection | ✅ | Checks if any active plan exists for the resource |
| Unauthenticated user for paid resource | ✅ | Returns false |
| Admin bypass | ✅ | Always returns true |
| WHOLE_APP entitlement | ✅ | Grants access to everything |
| Direct COURSE entitlement | ✅ | Exact match on courseId |
| CATEGORY entitlement covering course | ✅ | Uses ancestor chain correctly |
| Category hierarchy (parent → child access) | ✅ | `getCategoryAncestors` walks up the tree |
| Expired entitlements filtered | ✅ | `validUntil: { gt: new Date() }` |
| CATEGORY → subcategory access | ✅ | Ancestor chain includes self |

**Overall `hasAccess` verdict: ✅ Correct** — The access calculation logic itself is sound. Parent category entitlements correctly grant access to child categories and their courses.

### `attachPricingToCourses` review (course.service.ts)

| Check | Status | Notes |
|-------|--------|-------|
| Category hierarchy for ownership | ✅ | Ancestor chain checked |
| Category hierarchy for pricing | ✅ | Finds nearest plan |
| Admin bypass | ✅ | Always has access |
| Free course detection | ✅ | `!plan` means free |

### `attachPricingToCategories` review (category.service.ts)

| Check | Status | Notes |
|-------|--------|-------|
| Recursive child access inheritance | ✅ | `parentHasAccess` propagated down |
| Ancestor entitlement check | ✅ | All ancestors checked |
| Direct pricing display | ✅ | Shows only direct plans, not inherited |

---

## 8. Recommendations Summary

### Must Fix (Critical):

| # | Issue | Priority |
|---|-------|----------|
| 1 | **Revoke entitlement on `subscription.cancelled` webhook** | 🔴 Critical |
| 2 | **Revoke entitlement on `cancelImmediately()`** | 🔴 Critical |
| 3 | **Handle `cancelAtPeriodEnd` expiry** (revoke when period ends) | 🔴 Critical | 
| 4 | **Fix RTDN payload format** for Google Play | 🔴 Critical |
| 5 | **Fix webhook signature verification** — use raw body | 🔴 Critical |

### Should Fix (High Priority):

| # | Issue | Priority |
|---|-------|----------|
| 6 | **Set up background jobs** (trial expiry, grace period, abandoned orders) | 🟠 High |
| 7 | **Fix `cleanupRedundantSubscriptions`** to handle nested category hierarchy | 🟠 High |
| 8 | **Add category overlap check** in `purchase.service.ts` | 🟠 High |
| 9 | **Cancel gateway subscriptions** when cancelling pending subs | 🟠 High |
| 10 | **Add idempotency** to `handleInvoiceGenerated` | 🟠 High |

### Nice to Have:

| # | Issue | Priority |
|---|-------|----------|
| 11 | Track trial usage per plan (not global) — if business requires it | 🟡 Medium |
| 12 | Add audit trail for entitlement changes | 🟡 Medium |
| 13 | Add refund webhook handler | 🟡 Medium |
| 14 | Add email/push notifications for subscription events | 🟡 Medium |
| 15 | Add rate limiting on subscription endpoints | 🟡 Medium |
| 16 | Remove `@@unique([userId, planId])` for subscription history | 🟡 Medium |
| 17 | Fix `getUserActiveSubscription` to return all active subs | 🟡 Medium |
| 18 | Deepen category fetch beyond 2 levels | 🟢 Low |
| 19 | Add Razorpay pause/resume support | 🟢 Low |
| 20 | Implement `reconcilePayments` properly | 🟢 Low |

---

## Quick Reference: What Happens in Each Scenario

| Scenario | Current Behavior | Expected Behavior |
|----------|-----------------|-------------------|
| User subscribes to course | ✅ Gets access | ✅ Correct |
| User subscribes to category | ✅ Gets access to all courses in category + children | ✅ Correct |
| User subscribes to WHOLE_APP | ✅ Gets access to everything | ✅ Correct |
| User cancels subscription (immediately) | ❌ Keeps access forever | Lose access immediately |
| User cancels at period end | ❌ Keeps access forever (entitlement never revoked) | Lose access when period ends |
| User's payment fails | ✅ 7-day grace period, then halted + entitlement revoked | ✅ Correct |
| User buys category when owns course in it | ✅ Allowed (redundant course marked cancelAtPeriodEnd) | ⚠️ Only direct category match cleaned |
| User buys course when has category | ✅ Correctly blocked | ✅ Correct |
| User upgrades to WHOLE_APP | ✅ Lower tiers scheduled for cancellation | ✅ Correct |
| Google Play RTDN received | ❌ Crashes (wrong payload) | Process correctly like Razorpay |
| User re-subscribes after cancellation | ⚠️ Reuses old record (upsert) | Should preserve historical data |
| Lifetime purchase | ✅ Permanent access, no expiry | ✅ Correct |
| Admin revokes entitlement | ✅ Works | ⚠️ No audit trail |
| Background jobs (trial expiry, grace expiry) | ❌ Never run | Should run on schedule |

---

*This audit was performed by reviewing all source files in the subscription, payment, entitlement, and access control pipeline. No code changes were made.*
