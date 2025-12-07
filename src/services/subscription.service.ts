/**
 * Subscription Service
 * Flexible subscription with optional trial (free or paid)
 */

import { prisma } from "@/lib/db";
import { UserSubscription, SubscriptionStatus } from "@/prisma/generated/prisma/client";
import { createGatewaySubscription, cancelGatewaySubscription } from "@/lib/payment-gateway";

// ==================== INITIATE SUBSCRIPTION ====================

/**
 * Initiate subscription with flexible trial options:
 * - No trial: trialDays = 0
 * - Free trial: trialDays > 0, trialFee = 0
 * - Paid trial: trialDays > 0, trialFee > 0
 */
export const initiateSubscription = async (userId: string, planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId, isActive: true },
  });

  if (!plan) {
    throw new Error("Plan not found or inactive");
  }

  if (!plan.planId) {
    throw new Error("Plan not synced with payment gateway");
  }

  // Get user to check if they've used trial
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hasUsedTrial: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check for existing subscriptions (including pending)
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["pending", "trial", "active", "past_due"] },
    },
  });

  if (existingSubscription) {
    // Block if active, trial, or past_due
    if (["trial", "active", "past_due"].includes(existingSubscription.status)) {
      throw new Error("You already have an active subscription");
    }

    // Handle pending subscriptions
    if (existingSubscription.status === "pending") {
      const pendingAge = Date.now() - existingSubscription.createdAt.getTime();
      const STALE_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours

      if (pendingAge > STALE_TIMEOUT) {
        // Auto-cancel stale pending subscription
        await prisma.userSubscription.update({
          where: { id: existingSubscription.id },
          data: { status: "cancelled" },
        });
      } else {
        // Recent pending subscription - ask user to cancel first
        throw new Error(
          "You have a pending subscription. Please cancel it first using DELETE /api/subscriptions/pending"
        );
      }
    }
  }

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

  const subscription = await prisma.userSubscription.create({
    data: {
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
    amount: hasTrialFee ? plan.trialFee : plan.price,
    currency: plan.currency,
    keyId: process.env.RAZORPAY_KEY_ID!,
    trialDays: hasTrial ? plan.trialDays : 0,
    planName: plan.name,
    hasTrial,
    hasTrialFee,
    message: hasTrial
      ? hasTrialFee
        ? `Pay ₹${plan.trialFee} trial fee for ${plan.trialDays} days trial`
        : `Free ${plan.trialDays} days trial, then ₹${plan.price}/${plan.subscriptionType}`
      : `Direct subscription: ₹${plan.price}/${plan.subscriptionType}`,
  };
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
  return await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "cancelled",
      currentPeriodEnd: new Date(),
    },
    include: {
      plan: true,
    },
  });
};

// ==================== BACKGROUND JOBS ====================

/**
 * Expire trial subscriptions (background job)
 */
export const expireTrialSubscriptions = async (): Promise<number> => {
  const result = await prisma.userSubscription.updateMany({
    where: {
      status: "trial",
      isTrial: true,
      trialEndsAt: { lte: new Date() },
    },
    data: {
      status: "active",
      isTrial: false,
    },
  });

  return result.count;
};

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
 * Get user's subscription status (optimized single query)
 */
export const getUserSubscriptionStatus = async (userId: string) => {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["pending", "trial", "active", "past_due"] },
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
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return { hasSubscription: false, canSubscribe: true };
  }

  const isPending = subscription.status === "pending";
  const pendingAge = Date.now() - subscription.createdAt.getTime();
  const isStale = isPending && pendingAge > 48 * 60 * 60 * 1000;

  return {
    hasSubscription: true,
    canSubscribe: isPending && isStale,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      planName: subscription.plan.name,
      planType: subscription.plan.subscriptionType,
      createdAt: subscription.createdAt,
      isPending,
      isStale,
    },
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

// ==================== CONTENT ACCESS CONTROL ====================

/**
 * Check if user has active subscription
 * Active means: trial, active, or past_due (grace period)
 */
export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  if (!userId) return false;

  const subscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: { in: ["trial", "active", "past_due"] },
    },
    select: { id: true },
  });

  return !!subscription;
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
          planName: subscription.plan.name,
          planType: subscription.plan.subscriptionType,
        }
      : null,
  };
};
