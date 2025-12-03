/**
 * Subscription Service
 * Handles user subscription lifecycle
 */

import { prisma } from "@/lib/db";
import { UserSubscription, SubscriptionStatus, Prisma } from "@/prisma/generated/prisma/client";
import { getPlanBySlug, getPlanById } from "@/services/plan.service";
import {
  createGatewaySubscription,
  getGatewaySubscription,
  cancelGatewaySubscription,
} from "@/lib/payment-gateway";

// ==================== INITIATE SUBSCRIPTION ====================

/**
 * Initiate subscription for a user
 * Handles both free trial and paid trial flows
 */
export const initiateSubscription = async (
  userId: string,
  planId: string
): Promise<{
  subscription?: UserSubscription;
  requiresPayment: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
}> => {
  console.log(`[SUBSCRIPTION] Initiating subscription for user: ${userId}, plan: ${planId}`);

  // Get plan details
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });

  if (!plan) {
    console.error(`[SUBSCRIPTION] ❌ Plan not found: ${planId}`);
    throw new Error(`Plan not found with ID: ${planId}`);
  }

  console.log(`[SUBSCRIPTION] Plan found:`, {
    id: plan.id,
    name: plan.name,
    isPaidTrial: plan.isPaidTrial,
    trialFee: plan.trialFee,
    trialDays: plan.trialDays,
  });

  // Check if user already has an active subscription
  const existingSubscription = await getUserActiveSubscription(userId);
  if (existingSubscription) {
    console.log(
      `[SUBSCRIPTION] User ${userId} already has active subscription:`,
      existingSubscription.id
    );
    throw new Error("User already has an active subscription");
  }
  console.log(`[SUBSCRIPTION] No existing active subscription found for user`);

  // Check if this is a paid trial
  if (plan.isPaidTrial && plan.trialFee) {
    console.log(
      `[SUBSCRIPTION] Paid trial detected. Creating subscription with trial fee addon...`
    );

    if (!plan.planId) {
      throw new Error("Plan not synced with payment gateway. Please sync first.");
    }

    // Create subscription with addon for trial fee
    // This ensures payment method is captured and linked to subscription
    const gatewaySubscription = await createGatewaySubscription({
      planId: plan.planId,
      totalCount: 120, // ~10 years
      customerNotify: true,
      addons: [
        {
          item: {
            name: `${plan.name} - Trial Fee`,
            amount: plan.trialFee,
            currency: plan.currency,
          },
        },
      ],
      notes: {
        userId,
        planId: plan.id,
        type: "paid_trial",
      },
    });

    console.log(`[SUBSCRIPTION] Razorpay subscription created with trial addon:`, {
      subscriptionId: gatewaySubscription.id,
      status: gatewaySubscription.status,
      shortUrl: gatewaySubscription.shortUrl,
    });

    // Create subscription record
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId: plan.id,
        subscriptionId: gatewaySubscription.id,
        status: "created", // Will be "authenticated" after payment
        isTrial: true,
      },
    });

    console.log(`[SUBSCRIPTION] Subscription record created:`, subscription.id);

    // Create payment record for trial fee
    const payment = await prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        subscriptionId: subscription.id,
        amount: plan.trialFee,
        currency: plan.currency,
        paymentType: "trial",
        status: "pending",
      },
    });
    console.log(`[SUBSCRIPTION] Payment record created in DB:`, payment.id);

    // Return subscription details for frontend checkout
    console.log(`[SUBSCRIPTION] Returning subscription details to frontend`);
    return {
      requiresPayment: true,
      userSubscriptionId: subscription.id,
      subscriptionId: gatewaySubscription.id,
      shortUrl: gatewaySubscription.shortUrl,
      amount: plan.trialFee,
      currency: plan.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planDetails: {
        name: plan.name,
        price: plan.price,
        trialDays: plan.trialDays,
        trialFee: plan.trialFee,
      },
    };
  }

  // Free trial or no trial - create subscription directly
  console.log(`[SUBSCRIPTION] Free trial or no trial. Creating subscription in Razorpay...`);

  if (!plan.planId) {
    console.error(`[SUBSCRIPTION] Plan not synced with payment gateway. Plan ID: ${plan.id}`);
    throw new Error("Plan not synced with payment gateway");
  }

  const gatewaySubscription = await createGatewaySubscription({
    planId: plan.planId,
    totalCount: 120, // 10 years for monthly, 120 years for yearly (effectively unlimited)
    customerNotify: true,
    notes: {
      userId,
      planId: plan.id,
    },
  });
  console.log(`[SUBSCRIPTION] Razorpay subscription created:`, {
    subscriptionId: gatewaySubscription.id,
    status: gatewaySubscription.status,
  });

  // Create subscription record
  const subscription = await prisma.userSubscription.create({
    data: {
      userId,
      planId: plan.id,
      subscriptionId: gatewaySubscription.id,
      status: "pending",
      isTrial: (plan.trialDays && plan.trialDays > 0) || false,
    },
    include: {
      plan: true,
    },
  });
  console.log(`[SUBSCRIPTION] Subscription record created in DB:`, {
    id: subscription.id,
    status: subscription.status,
    isTrial: subscription.isTrial,
  });
  console.log(
    `[SUBSCRIPTION] ✅ Subscription initiated successfully. Waiting for Razorpay webhook to activate...`
  );

  return {
    subscription,
    requiresPayment: false,
  };
};

// ==================== VERIFY PAID TRIAL PAYMENT ====================

/**
 * Verify paid trial payment and create subscription
 */
export const verifyPaidTrialPayment = async (
  userId: string,
  orderId: string,
  paymentId: string
): Promise<UserSubscription> => {
  console.log(`[PAYMENT] Verifying paid trial payment:`, { userId, orderId, paymentId });

  // Find payment record (can be pending or already paid by webhook)
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      orderId,
    },
    include: {
      plan: true,
    },
  });

  if (!payment) {
    console.error(`[PAYMENT] Payment not found:`, { userId, orderId });
    throw new Error("Payment not found");
  }
  console.log(`[PAYMENT] Payment record found:`, {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    planName: payment.plan.name,
  });

  // Check if subscription already exists (webhook might have created it)
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId,
      planId: payment.planId,
      status: {
        in: ["pending", "trial", "active"],
      },
    },
    include: {
      plan: true,
    },
  });

  if (existingSubscription) {
    console.log(
      `[PAYMENT] Subscription already exists (created by webhook):`,
      existingSubscription.id
    );
    return existingSubscription;
  }
  console.log(`[PAYMENT] Payment record found:`, {
    id: payment.id,
    amount: payment.amount,
    planName: payment.plan.name,
  });

  // Update payment to paid
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentId,
      status: "paid",
    },
  });
  console.log(`[PAYMENT] Payment status updated to 'paid' in DB`);

  // Now create subscription in gateway
  if (!payment.plan.planId) {
    console.error(`[PAYMENT] Plan not synced with payment gateway. Plan ID: ${payment.planId}`);
    throw new Error("Plan not synced with payment gateway");
  }
  console.log(`[PAYMENT] Creating subscription in Razorpay after successful payment...`);

  const gatewaySubscription = await createGatewaySubscription({
    planId: payment.plan.planId,
    totalCount: 120, // 10 years for monthly, 120 years for yearly (effectively unlimited)
    customerNotify: true,
    notes: {
      userId,
      planId: payment.planId,
      paidTrialOrderId: orderId,
    },
  });
  console.log(`[PAYMENT] Razorpay subscription created:`, {
    subscriptionId: gatewaySubscription.id,
    status: gatewaySubscription.status,
  });

  // Create subscription record
  const subscription = await prisma.userSubscription.create({
    data: {
      userId,
      planId: payment.planId,
      subscriptionId: gatewaySubscription.id,
      status: "pending",
      isTrial: true,
    },
    include: {
      plan: true,
    },
  });
  console.log(`[PAYMENT] Subscription record created in DB:`, {
    id: subscription.id,
    status: subscription.status,
  });
  console.log(
    `[PAYMENT] ✅ Paid trial verified successfully. Waiting for Razorpay webhook to activate...`
  );

  return subscription;
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

// ==================== SYNC SUBSCRIPTION ====================

/**
 * Sync subscription status from payment gateway
 */
export const syncSubscriptionFromGateway = async (
  subscriptionId: string
): Promise<UserSubscription> => {
  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription || !subscription.subscriptionId) {
    throw new Error("Subscription not found or not linked to gateway");
  }

  // Get subscription from gateway
  const gatewaySubscription = await getGatewaySubscription(subscription.subscriptionId);

  // Map gateway status to our status
  let status: SubscriptionStatus = subscription.status;
  switch (gatewaySubscription.status) {
    case "created":
      status = "pending";
      break;
    case "authenticated":
    case "active":
      status = subscription.isTrial ? "trial" : "active";
      break;
    case "paused":
      status = "past_due";
      break;
    case "halted":
      status = "halted";
      break;
    case "cancelled":
    case "completed":
      status = "cancelled";
      break;
    case "expired":
      status = "expired";
      break;
  }

  // Update subscription
  return await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      currentPeriodStart: gatewaySubscription.current_start
        ? new Date(gatewaySubscription.current_start * 1000)
        : undefined,
      currentPeriodEnd: gatewaySubscription.current_end
        ? new Date(gatewaySubscription.current_end * 1000)
        : undefined,
      nextBillingAt: gatewaySubscription.charge_at
        ? new Date(gatewaySubscription.charge_at * 1000)
        : undefined,
    },
    include: {
      plan: true,
    },
  });
};

// ==================== BACKGROUND JOBS ====================

/**
 * Expire trial subscriptions (background job)
 * Run daily to check for expired trials
 */
export const expireTrialSubscriptions = async (): Promise<number> => {
  const now = new Date();

  const expiredTrials = await prisma.userSubscription.findMany({
    where: {
      status: "trial",
      isTrial: true,
      trialEndsAt: {
        lte: now,
      },
    },
  });

  for (const subscription of expiredTrials) {
    // Trial ended - gateway should automatically charge
    // Update status to active (will be confirmed by webhook)
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "active",
        isTrial: false,
      },
    });
  }

  return expiredTrials.length;
};

/**
 * Expire grace periods (background job)
 * Run daily to check for expired grace periods
 */
export const expireGracePeriods = async (): Promise<number> => {
  const now = new Date();

  const expiredGracePeriods = await prisma.userSubscription.findMany({
    where: {
      status: "past_due",
      graceUntil: {
        lte: now,
      },
    },
  });

  for (const subscription of expiredGracePeriods) {
    // Grace period expired - halt subscription
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "halted",
      },
    });
  }

  return expiredGracePeriods.length;
};
