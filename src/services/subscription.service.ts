/**
 * Subscription Service
 * Flexible subscription with optional trial (free or paid)
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { UserSubscription, SubscriptionStatus } from "@/prisma/generated/prisma/client";
import { createGatewaySubscription, cancelGatewaySubscription, createGatewayOrder } from "@/lib/payment-gateway";
import { GooglePlayReceipt } from "@/lib/types";
import { google_auth } from "@/lib/pub_sub";
import { syncSubscriptionToEntitlement } from "./entitlement.service";
import { sendFbPurchaseEvent } from "./facebook.service";

// ==================== INITIATE SUBSCRIPTION ====================

/**
 * Initiate subscription with flexible trial options:
 * - No trial: trialDays = 0
 * - Free trial: trialDays > 0, trialFee = 0
 * - Paid trial: trialDays > 0, trialFee > 0
 */
export const initiateSubscription = async (userId: string, planId: string, data?: any) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new Error("Plan not found or inactive");
  }

  // 1. Overlapping Checks using Entitlements (Applies to all providers)
  const activeEntitlements = await prisma.userEntitlement.findMany({
    where: {
      userId,
      status: "active",
      OR: [
        { validUntil: null },
        { validUntil: { gt: new Date() } }
      ]
    }
  });

  // Helper to get all category ancestors for hierarchy checks
  const getCategoryAncestors = async (catId: string): Promise<string[]> => {
    const ancestors: string[] = [catId];
    let currentId: string | null = catId;
    while (currentId) {
      const cat: any = await prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true }
      });
      if (cat?.parentId) {
        ancestors.push(cat.parentId);
        currentId = cat.parentId;
      } else {
        currentId = null;
      }
    }
    return ancestors;
  };

  // If user has WHOLE_APP, block all other recurring subscriptions
  if (activeEntitlements.some(e => e.type === "WHOLE_APP")) {
    throw new Error("You already have an active Full App access. No need to subscribe again.");
  }

  // Hierarchical Overlap Check
  if (plan.planType === "COURSE") {
    const course = await prisma.course.findUnique({
      where: { id: plan.targetId! },
      select: { categoryId: true }
    });

    if (course) {
      const catAncestors = await getCategoryAncestors(course.categoryId);
      if (activeEntitlements.some(e => e.type === "CATEGORY" && catAncestors.includes(e.targetId as string))) {
        throw new Error("You already have access to this course through your existing category subscription.");
      }
    }
  }

  if (plan.planType === "CATEGORY") {
    const ancestors = await getCategoryAncestors(plan.targetId!);
    // Check if user owns any ancestor of the category they are trying to buy
    if (activeEntitlements.some(e => e.type === "CATEGORY" && ancestors.includes(e.targetId as string))) {
      throw new Error("You already have access to this category (or its parent).");
    }
  }

  // Direct Overlap: If user already has this specific entitlement
  if (plan.planType === "COURSE") {
    const hasExistingDirect = activeEntitlements.some(e => e.type === "COURSE" && e.targetId === plan.targetId);
    if (hasExistingDirect) {
      throw new Error(`You already have active access to this course.`);
    }
  }

  // Prevent paying for free plans
  if ((plan.discountedPrice ?? plan.price) <= 0) {
    throw new Error("This plan is free. You don't need to initiate a purchase.");
  }

  // 2. Provider Specific Logic
  if (plan.provider === 'google_play') {
    if (!data?.receipt) throw new Error("Google Play receipt data is required");

    const receipt = data.receipt;
    const lineItem = receipt.lineItems[0];
    const expiryTime = new Date(lineItem.expiryTime);
    const startTime = new Date(receipt.startTime);

    const isTrial = receipt.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
      || (lineItem.offerDetails?.offerTags?.includes('trial'));

    const status = isTrial ? 'trial' : 'active';
    const sub: any = await prisma.userSubscription.upsert({
      where: {
        userId_planId: {
          userId,
          planId
        }
      },
      update: {
        currentPurchaseToken: data.purchaseToken,
        currentPeriodStart: startTime,
        currentPeriodEnd: expiryTime,
        status: status,
        updatedAt: new Date(),
      },
      create: {
        userId,
        planId: plan.id,
        provider: 'google_play',
        currentPurchaseToken: data.purchaseToken,
        status,
        currentPeriodStart: startTime,
        currentPeriodEnd: expiryTime,
        isTrial: !!isTrial,
      }
    });

    await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        userSubscriptionId: sub.id,
        orderId: receipt.orderId,
        amount: plan.discountedPrice ?? plan.price,
        currency: plan.currency,
        paymentGateway: 'google_play',
        status: 'paid',
        paymentType: isTrial ? 'trial' : 'recurring',
        eventType: receipt.subscriptionState,
      }
    });

    await syncSubscriptionToEntitlement(sub.id);
    return sub;
  }

  // Razorpay Specific Checks
  if (!plan.planId) {
    throw new Error("Razorpay Plan ID missing from system. Please contact support.");
  }

  // Check for existing pending/active recurring subscriptions
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["pending", "trial", "active", "past_due"] },
      planId: plan.id
    },
  });

  if (existingSubscription) {
    if (["trial", "active", "past_due"].includes(existingSubscription.status)) {
      throw new Error("You already have an active subscription for this plan.");
    }

    if (existingSubscription.status === "pending") {
      // Auto-cancel previous pending attempt to allow a fresh start (Better UX)
      console.log(`[Subscription] Cancelling old pending subscription ${existingSubscription.id} for user ${userId}`);

      // 1. Cancel in Gateway if it exists (Recurring Razorpay)
      if (existingSubscription.subscriptionId) {
        try {
          await cancelGatewaySubscription(existingSubscription.subscriptionId, false);
        } catch (err) {
          console.warn(`[Subscription] Gateway cancellation failed (may already be invalid):`, err);
        }
      }

      // 2. Mark old subscription and its pending payments as cancelled/failed
      await prisma.$transaction([
        prisma.userSubscription.update({
          where: { id: existingSubscription.id },
          data: { status: "cancelled", updatedAt: new Date() },
        }),
        prisma.payment.updateMany({
          where: {
            userSubscriptionId: existingSubscription.id,
            status: "pending"
          },
          data: {
            status: "failed",
            metadata: { cancellationReason: "Replaced by new subscription attempt" }
          }
        })
      ]);
    }
  }

  // Get user for Razorpay trial logic
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasUsedTrial: true },
  });

  if (!user) throw new Error("User not found");

  // ==================== LIFETIME (ONE-TIME) FLOW ====================
  if (plan.subscriptionType === "lifetime") {
    // 1. Create order in gateway
    const gatewayOrder = await createGatewayOrder({
      amount: plan.discountedPrice ?? plan.price, // already in paise
      currency: plan.currency,
      notes: {
        userId,
        planId: plan.id,
        type: "ONE_TIME_PURCHASE",
      },
    });

    // 2. Create/Update User Subscription Record (Pending)
    const subscription = await prisma.userSubscription.upsert({
      where: {
        userId_planId: {
          userId,
          planId: plan.id,
        }
      },
      update: {
        status: "pending",
        updatedAt: new Date()
      },
      create: {
        userId,
        planId: plan.id,
        status: "pending",
        provider: "razorpay"
      }
    });

    // 3. Create pending payment record
    await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        userSubscriptionId: subscription.id,
        orderId: gatewayOrder.id,
        amount: plan.discountedPrice ?? plan.price,
        currency: plan.currency,
        paymentType: "one_time",
        status: "pending",
        metadata: {
          planName: plan.name,
          planType: plan.planType,
          targetId: plan.targetId
        }
      },
    });

    return {
      orderId: gatewayOrder.id,
      amount: plan.discountedPrice ?? plan.price,
      currency: plan.currency,
      keyId: process.env.RAZORPAY_KEY_ID!,
      planName: plan.name,
      subscriptionType: "lifetime",
      userSubscriptionId: subscription.id,
      message: `Direct purchase: ₹${(plan.discountedPrice ?? plan.price) / 100} for lifetime access`,
    };
  }

  // ==================== RECURRING FLOW ====================
  // Determine if user can get trial - only if plan has trial AND user hasn't used it
  const canUseTrial = plan.trialDays > 0 && !user.hasUsedTrial;
  const hasTrial = canUseTrial;
  const hasTrialFee = canUseTrial && plan.trialFee > 0;
  const isFreeTrialOrNoTrial = !hasTrialFee;

  // Calculate billing start (immediate if no trial, delayed if trial)
  const startAt = hasTrial
    ? Math.floor(Date.now() / 1000) + plan.trialDays * 24 * 60 * 60
    : undefined;

  // Build subscription request
  const subscriptionData: any = {
    planId: plan.planId,
    totalCount: plan.subscriptionType === "monthly" ? 120 : 12,
    customerNotify: true,
    startAt,
    notes: {
      userId,
      planId: plan.id,
      trialDays: plan.trialDays.toString(),
      trialFee: plan.trialFee.toString(),
      subscriptionType: hasTrial ? (hasTrialFee ? "paid_trial" : "free_trial") : "direct",
    },
  };

  // Add addon only if trial fee exists (this charges immediately)
  if (hasTrialFee) {
    subscriptionData.addons = [
      {
        item: {
          name: `${plan.name} - Trial Fee`,
          amount: plan.trialFee,
          currency: plan.currency,
        },
      },
    ];
  }

  const gatewaySubscription = await createGatewaySubscription(subscriptionData);

  // Determine initial status based on subscription type
  let initialStatus: SubscriptionStatus = "pending";
  if (isFreeTrialOrNoTrial) {
    // Free trial or no trial - Razorpay activates immediately (no payment required)
    // Will be updated to "trial" or "active" by webhook
    initialStatus = "pending";
  } else {
    // Paid trial - waiting for user to pay addon
    initialStatus = "pending";
  }

  const subscription = await prisma.userSubscription.upsert({
    where: {
      userId_planId: {
        userId,
        planId: plan.id,
      },
    },
    update: {
      subscriptionId: gatewaySubscription.id,
      status: initialStatus,
      isTrial: hasTrial,
      updatedAt: new Date(),
    },
    create: {
      userId,
      planId: plan.id,
      subscriptionId: gatewaySubscription.id,
      status: initialStatus,
      isTrial: hasTrial,
    },
  });

  // Create payment record only if there's a trial fee (addon)
  if (hasTrialFee) {
    await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        userSubscriptionId: subscription.id,
        gatewaySubscriptionId: gatewaySubscription.id,
        amount: plan.trialFee,
        currency: plan.currency,
        paymentType: "trial",
        status: "pending",
        metadata: {
          isAddon: true,
          addonName: `${plan.name} - Trial Fee`,
        },
      },
    });
  }

  return {
    subscriptionId: gatewaySubscription.id,
    shortUrl: gatewaySubscription.shortUrl!,
    amount: hasTrialFee ? plan.trialFee : (plan.discountedPrice ?? plan.price),
    currency: plan.currency,
    keyId: process.env.RAZORPAY_KEY_ID!,
    trialDays: hasTrial ? plan.trialDays : 0,
    planName: plan.name,
    hasTrial,
    hasTrialFee,
    message: hasTrial
      ? hasTrialFee
        ? `Pay ₹${plan.trialFee / 100} trial fee for ${plan.trialDays} days trial`
        : `Free ${plan.trialDays} days trial, then ₹${(plan.discountedPrice ?? plan.price) / 100}/${plan.subscriptionType}`
      : `Direct subscription: ₹${(plan.discountedPrice ?? plan.price) / 100}/${plan.subscriptionType}`,
  };
};

// ==================== VERIFY SUBSCRIPTION ====================

/**
 * Verify subscription payment signature and activate (from Frontend Modal)
 */
export const verifySubscription = async (
  userId: string,
  subscriptionId: string,
  paymentId: string,
  signature: string
) => {
  // 1. Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(paymentId + "|" + subscriptionId)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new Error("Invalid payment signature. Fraudulent transaction detected.");
  }

  // 2. Find internal subscription record
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
    include: {
      plan: true,
      user: {
        select: { email: true, phone: true }
      }
    },
  });

  if (!subscription || !subscription.plan) {
    throw new Error("Subscription record or associated plan not found.");
  }

  if (subscription.userId !== userId) {
    throw new Error("Unauthorized: Subscription does not belong to this user.");
  }

  // 3. Skip if already active/trial (avoid redundant heavy processing)
  if (subscription.status === "active" || subscription.status === "trial") {
    console.log(`[Verify] Subscription ${subscriptionId} already processed (status: ${subscription.status})`);
    return subscription;
  }

  // 4. Determine status and trial dates
  const hasTrial = subscription.plan.trialDays > 0;

  let trialEndsAt: Date | null = null;
  if (hasTrial) {
    trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + (subscription.plan.trialDays || 0));
  }

  const finalStatus: SubscriptionStatus = hasTrial ? "trial" : "active";

  console.log(`[Verify] Manually activating subscription ${subscriptionId} to ${finalStatus}`);

  // 5. Atomic Update
  const updatedSub = await prisma.$transaction(async (tx) => {
    // A. Update Payment Record
    await tx.payment.updateMany({
      where: {
        gatewaySubscriptionId: subscriptionId,
        status: "pending",
      },
      data: {
        status: "paid",
        paymentId,
        updatedAt: new Date(),
        isWebhookProcessed: true,
      },
    });

    // B. Update Subscription
    const sub = await tx.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: finalStatus,
        trialEndsAt,
        updatedAt: new Date(),
      },
      include: { plan: true }
    });

    // C. Update User
    if (hasTrial) {
      await tx.user.update({
        where: { id: userId },
        data: { hasUsedTrial: true },
      });
    }

    return sub;
  });

  // 6. Post-transaction tasks
  try {
    sendFbPurchaseEvent({
      email: subscription.user?.email,
      phone: subscription.user?.phone,
      amount: subscription.plan.trialFee || 0,
      currency: subscription.plan.currency,
      paymentId: paymentId,
      itemName: subscription.plan.name,
      itemType: subscription.plan.planType,
    });

    await syncSubscriptionToEntitlement(updatedSub.id);
    await cleanupRedundantSubscriptions(userId, subscription.plan.planType, subscription.plan.targetId || undefined);

  } catch (err) {
    console.error(`[Verify] Post-verification tasks failed:`, err);
  }

  return updatedSub;
};

// ==================== GET SUBSCRIPTIONS ====================

/**
 * Get user's active subscription
 */
export const getUserActiveSubscription = async (
  userId: string
): Promise<UserSubscription | null> => {
  return await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: {
        in: ["pending", "trial", "active", "past_due"],
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Get user's subscription by ID
 */
export const getSubscriptionById = async (id: string): Promise<UserSubscription> => {
  const subscription = await prisma.userSubscription.findUnique({
    where: { id },
    include: {
      plan: true,
      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  return subscription;
};

/**
 * Get all user subscriptions (history)
 */
export const getUserSubscriptions = async (userId: string): Promise<UserSubscription[]> => {
  return await prisma.userSubscription.findMany({
    where: { userId },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// ==================== CANCEL SUBSCRIPTION ====================

/**
 * Cancel subscription at period end
 */
export const cancelAtPeriodEnd = async (
  userId: string,
  subscriptionId: string
): Promise<UserSubscription> => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      status: {
        in: ["trial", "active"],
      },
    },
  });

  if (!subscription) {
    throw new Error("Active subscription not found");
  }

  if (!subscription.subscriptionId) {
    throw new Error("Subscription not linked to payment gateway");
  }

  // Cancel in gateway (at period end)
  await cancelGatewaySubscription(subscription.subscriptionId, true);

  // Update subscription
  return await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtPeriodEnd: true,
    },
    include: {
      plan: true,
    },
  });
};

/**
 * Cancel subscription immediately
 */
export const cancelImmediately = async (
  userId: string,
  subscriptionId: string
): Promise<UserSubscription> => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      status: {
        in: ["trial", "active", "past_due"],
      },
    },
  });

  if (!subscription) {
    throw new Error("Active subscription not found");
  }

  if (!subscription.subscriptionId) {
    throw new Error("Subscription not linked to payment gateway");
  }

  // Cancel in gateway (immediately)
  await cancelGatewaySubscription(subscription.subscriptionId, false);

  // Update subscription
  const updatedSub = await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "cancelled",
      currentPeriodEnd: new Date(),
    },
    include: {
      plan: true,
    },
  });

  // Sync to entitlement (This will revoke access)
  await syncSubscriptionToEntitlement(updatedSub.id);

  return updatedSub;
};

// ==================== BACKGROUND JOBS ====================

/**
 * Expire grace periods (background job)
 */
export const expireGracePeriods = async (): Promise<number> => {
  const result = await prisma.userSubscription.updateMany({
    where: {
      status: "past_due",
      graceUntil: { lte: new Date() },
    },
    data: { status: "halted" },
  });

  return result.count;
};

// ==================== PENDING SUBSCRIPTION MANAGEMENT ====================

/**
 * Get user's subscription status (Grouped by access type)
 */
export const getUserSubscriptionStatus = async (userId: string) => {
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId,
      status: { in: ["pending", "trial", "active", "past_due"] },
    },
    include: {
      plan: true
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedSubs = subscriptions.map(s => ({
    id: s.id,
    status: s.status,
    planName: s.plan?.name,
    planType: s.plan?.planType,
    targetId: s.plan?.targetId,
    subscriptionType: s.plan?.subscriptionType,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    nextBillingAt: s.nextBillingAt,
    isTrial: s.status === "trial",
    provider: s.provider
  }));

  return {
    hasActiveSubscription: subscriptions.some(s => s.status !== "pending"),
    wholeApp: formattedSubs.filter(s => s.planType === "WHOLE_APP"),
    categories: formattedSubs.filter(s => s.planType === "CATEGORY"),
    courses: formattedSubs.filter(s => s.planType === "COURSE"),
  };
};

/**
 * Cancel pending subscription (optimized with direct update)
 */
export const cancelPendingSubscription = async (userId: string): Promise<void> => {
  const result = await prisma.userSubscription.updateMany({
    where: {
      userId,
      status: "pending",
    },
    data: {
      status: "cancelled",
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new Error("No pending subscription found");
  }
};

/**
 * Cancel a specific pending subscription by ID
 */
export const cancelPendingSubscriptionById = async (userId: string, subscriptionId: string): Promise<void> => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
      status: "pending",
    },
  });

  if (!subscription) {
    throw new Error("Pending subscription not found or you don't have permission to cancel it");
  }

  await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "cancelled",
      updatedAt: new Date(),
    },
  });
};

// ==================== CONTENT ACCESS CONTROL ====================

/**
 * Check if user has active subscription
 * Active means: trial, active, or past_due (grace period)
 */
export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  if (!userId) return false;

  const entitlement = await prisma.userEntitlement.findFirst({
    where: {
      userId,
      status: "active",
      OR: [
        { validUntil: null },
        { validUntil: { gt: new Date() } }
      ]
    },
    select: { id: true },
  });

  return !!entitlement;
};

/**
 * Get user's subscription details for access control
 * Returns subscription info along with access permissions
 */
export const getUserAccessInfo = async (userId: string) => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["trial", "active", "past_due"] },
    },
    include: {
      plan: {
        select: {
          name: true,
          slug: true,
          subscriptionType: true,
        },
      },
    },
  });

  return {
    hasActiveSubscription: !!subscription,
    subscription: subscription
      ? {
        id: subscription.id,
        status: subscription.status,
        isTrial: subscription.isTrial,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        planName: subscription?.plan?.name,
        planType: subscription?.plan?.subscriptionType,
      }
      : null,
  };
};


export const verifyGooglePlayReceipt = async (purchaseToken: string, productId?: string): Promise<GooglePlayReceipt> => {
  try {

    const client = await google_auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${process.env.PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${purchaseToken}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) {
      throw new Error("Invalid purchase token");
    }
    const data = await res.json();
    return {
      startTime: data.startTime,
      subscriptionState: data.subscriptionState,
      orderId: data.latestOrderId,
      acknowledgementState: data.acknowledgementState,
      subscribeWithGoogleInfo: data.subscribeWithGoogleInfo,
      lineItems: data.lineItems,
    };

  } catch (error) {
    console.error("Error verifying Google Play receipt:", error);
    throw new Error("Failed to verify Google Play receipt");
  }
}

export const acknowledgeGooglePlayPurchase = async (token: string, productId: string) => {
  const client = await google_auth.getClient();
  const accessToken = await client.getAccessToken();

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${process.env.PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${token}:acknowledge`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ developerPayload: 'api_ack' })
  });

  if (!response.ok) {
    console.error(`Ack failed: ${await response.text()}`);
  }
};

/**
 * CLEANUP LOGIC: Schedule cancellation for redundant lower-tier subscriptions
 * Called when a user "Upgrades" to a higher tier (e.g., Category -> App)
 */
export const cleanupRedundantSubscriptions = async (userId: string, newPlanType: "WHOLE_APP" | "CATEGORY" | "COURSE", targetId?: string) => {
  // 1. Find all active/trial recurring subscriptions for this user
  const activeSubs = await prisma.userSubscription.findMany({
    where: {
      userId,
      status: { in: ["active", "trial"] },
      plan: {
        subscriptionType: { in: ["monthly", "yearly"] } // Only affect recurring
      }
    },
    include: { plan: true }
  });

  for (const sub of activeSubs) {
    if (!sub.plan) continue;
    let isRedundant = false;

    // If I just bought WHOLE_APP, everything else is redundant
    if (newPlanType === "WHOLE_APP" && sub.plan.planType !== "WHOLE_APP") {
      isRedundant = true;
    }

    // If I just bought a CATEGORY, individual courses in that category are redundant
    if (newPlanType === "CATEGORY" && sub.plan.planType === "COURSE") {
      const course = await prisma.course.findUnique({
        where: { id: sub.plan.targetId! },
        select: { categoryId: true }
      });
      if (course?.categoryId === targetId) {
        isRedundant = true;
      }
    }

    if (isRedundant && sub.subscriptionId) {
      console.log(`[Upgrade] Scheduling cancellation for redundant sub: ${sub.id} (Plan: ${sub.plan.name})`);
      try {
        // Cancel at period end in Gateway
        await cancelGatewaySubscription(sub.subscriptionId, true);
        // Update DB
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: true }
        });
      } catch (err) {
        console.error(`Failed to cancel redundant subscription ${sub.id}:`, err);
      }
    }
  }
};

// ==================== ADMIN: GET ALL SUBSCRIPTIONS ====================

/**
 * Get all user subscriptions (admin) with pagination and optional status filter
 */
export const getAllSubscriptions = async (
  page: number = 1,
  limit: number = 20,
  status?: SubscriptionStatus,
  search?: string
) => {
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { displayName: { contains: search, mode: "insensitive" } } }
    ];
  }

  const [subscriptions, total] = await Promise.all([
    prisma.userSubscription.findMany({
      where,
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userSubscription.count({ where }),
  ]);

  return {
    data: subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Admin: Grant manual subscription (Cash/Offline payment)
 */
export const grantManualSubscription = async (
  userId: string,
  planId: string,
  options: {
    amount?: number;
    expiryDate?: Date;
    notes?: string;
  } = {}
) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new Error("Plan not found or inactive");
  }

  // 1. Calculate Period
  const now = new Date();
  let currentPeriodEnd: Date | null = null;

  if (options.expiryDate) {
    currentPeriodEnd = options.expiryDate;
  } else if (plan.subscriptionType === "lifetime") {
    currentPeriodEnd = null; // No expiry for lifetime
  } else if (plan.subscriptionType === "monthly") {
    currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (plan.subscriptionType === "yearly") {
    currentPeriodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  // 2. Atomic Transaction: Subscription, Payment, and Entitlement
  return await prisma.$transaction(async (tx) => {
    // A. Create/Update Subscription
    const subscription = await tx.userSubscription.upsert({
      where: {
        userId_planId: { userId, planId },
      },
      update: {
        status: "active",
        provider: "manual",
        currentPeriodStart: now,
        currentPeriodEnd: currentPeriodEnd,
        isTrial: false,
        updatedAt: now,
      },
      create: {
        userId,
        planId,
        status: "active",
        provider: "manual",
        currentPeriodStart: now,
        currentPeriodEnd: currentPeriodEnd,
        isTrial: false,
      },
    });

    // B. Create Payment Record (Mark as Paid since it's manual/cash)
    const officialPrice = plan.discountedPrice ?? plan.price;
    const isCustomPrice = options.amount !== undefined && options.amount !== officialPrice;

    await tx.payment.create({
      data: {
        userId,
        planId,
        userSubscriptionId: subscription.id,
        amount: options.amount ?? officialPrice,
        currency: plan.currency,
        paymentGateway: "manual",
        paymentType: "one_time", // Manual grants NEVER auto-renew, so mark as one_time
        status: "paid",
        metadata: {
          grantReason: "Admin Manual Grant",
          notes: options.notes,
          isCustomPrice,
          originalPlanPrice: officialPrice
        },
      },
    });

    // C. Grant Entitlement
    await tx.userEntitlement.upsert({
      where: {
        userId_type_targetId: {
          userId,
          type: plan.planType,
          targetId: plan.targetId || "",
        },
      },
      update: {
        status: "active",
        source: "ADMIN_MANUAL",
        validUntil: currentPeriodEnd,
        updatedAt: now,
      },
      create: {
        userId,
        type: plan.planType,
        targetId: plan.targetId || "",
        status: "active",
        source: "ADMIN_MANUAL",
        validUntil: currentPeriodEnd,
      },
    });

    return subscription;
  });
};