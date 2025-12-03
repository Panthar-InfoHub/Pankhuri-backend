/**
 * Webhook Service
 * Handles payment gateway webhook events
 */

import { prisma } from "@/lib/db";
import { SubscriptionStatus, PaymentStatus } from "@/prisma/generated/prisma/client";

// ==================== WEBHOOK EVENT HANDLERS ====================

/**
 * Handle subscription.authenticated event (when user completes payment for subscription)
 * This fires after user pays the trial fee addon
 */
export const handleSubscriptionAuthenticated = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;

  console.log(`[WEBHOOK] 🎯 subscription.authenticated - Subscription ID: ${subscriptionId}`);
  console.log(`[WEBHOOK] User completed payment, subscription authenticated`);

  // Find subscription in database
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.error(`[WEBHOOK] ❌ Subscription not found in DB: ${subscriptionId}`);
    return;
  }

  console.log(`[WEBHOOK] Subscription found:`, {
    id: subscription.id,
    userId: subscription.userId,
    status: subscription.status,
    isTrial: subscription.isTrial,
  });

  // Update subscription status to authenticated
  // It will move to "active" when subscription.activated fires
  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "authenticated" as SubscriptionStatus,
    },
  });

  // Update payment record to paid
  await prisma.payment.updateMany({
    where: {
      userSubscriptionId: subscription.id,
      paymentType: "trial",
      status: "pending",
    },
    data: {
      status: "paid",
      isWebhookProcessed: true,
      eventType: "subscription.authenticated",
    },
  });

  console.log(`[WEBHOOK] ✅ Subscription authenticated, payment method captured`);
  console.log(`[WEBHOOK] Payment method is now linked for automatic recurring billing`);
};

/**
 * Handle subscription.activated event
 */
export const handleSubscriptionActivated = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;

  console.log(`[WEBHOOK] 🎯 subscription.activated - Subscription ID: ${subscriptionId}`);
  console.log(`[WEBHOOK] Subscription status from Razorpay: ${subscriptionEntity.status}`);

  // Find subscription in database
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.error(`[WEBHOOK] ❌ Subscription not found in DB: ${subscriptionId}`);
    return;
  }
  console.log(`[WEBHOOK] Subscription found in DB:`, {
    id: subscription.id,
    userId: subscription.userId,
    currentStatus: subscription.status,
    isTrial: subscription.isTrial,
  });

  // Calculate trial end date if applicable
  // For paid trials, calculate from when they paid the trial fee (order payment date)
  let trialEndsAt: Date | undefined;
  if (subscription.isTrial && subscription.plan.trialDays) {
    // Find the trial payment to get the actual payment date
    const trialPayment = await prisma.payment.findFirst({
      where: {
        userId: subscription.userId,
        planId: subscription.planId,
        paymentType: "trial",
        status: "paid",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (trialPayment) {
      // Calculate trial end from when user paid the trial fee
      trialEndsAt = new Date(trialPayment.createdAt);
      trialEndsAt.setDate(trialEndsAt.getDate() + subscription.plan.trialDays);
      console.log(`[WEBHOOK] Trial starts from payment date: ${trialPayment.createdAt}`);
      console.log(`[WEBHOOK] Trial will end on: ${trialEndsAt}`);
    } else {
      // Fallback: Free trial or no payment found, start from now
      trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + subscription.plan.trialDays);
      console.log(`[WEBHOOK] Free trial - starts from now, ends on: ${trialEndsAt}`);
    }
  }

  // Update subscription status
  const newStatus = subscription.isTrial ? "trial" : "active";
  console.log(`[WEBHOOK] Updating subscription status to: ${newStatus}`);

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: newStatus,
      trialEndsAt,
      currentPeriodStart: subscriptionEntity.current_start
        ? new Date(subscriptionEntity.current_start * 1000)
        : undefined,
      currentPeriodEnd: subscriptionEntity.current_end
        ? new Date(subscriptionEntity.current_end * 1000)
        : undefined,
      nextBillingAt: subscriptionEntity.charge_at
        ? new Date(subscriptionEntity.charge_at * 1000)
        : undefined,
    },
  });

  console.log(`[WEBHOOK] ✅ Subscription activated successfully:`, {
    subscriptionId,
    status: newStatus,
    trialEndsAt,
  });
};

/**
 * Handle order.paid event (for paid trial)
 */
export const handleOrderPaid = async (payload: any): Promise<void> => {
  const orderEntity = payload.payload.order.entity;
  const paymentEntity = payload.payload.payment.entity;
  const orderId = orderEntity.id;

  console.log(`[WEBHOOK] 🎯 order.paid - Order ID: ${orderId}`);
  console.log(`[WEBHOOK] Payment details:`, {
    paymentId: paymentEntity.id,
    method: paymentEntity.method,
    amount: orderEntity.amount,
  });

  // Find payment record
  const payment = await prisma.payment.findFirst({
    where: { orderId },
    include: {
      plan: true,
      user: true,
    },
  });

  if (!payment) {
    console.error(`[WEBHOOK] ❌ Payment not found for order: ${orderId}`);
    return;
  }

  // Check idempotency
  if (payment.isWebhookProcessed && payment.eventType === "order.paid") {
    console.log(`[WEBHOOK] ⚠️ Order already processed (idempotency check): ${orderId}`);
    return;
  }

  // Update payment
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "paid",
      paymentId: paymentEntity.id,
      paymentMethod: paymentEntity.method,
      isWebhookProcessed: true,
      eventType: "order.paid",
    },
  });

  console.log(`[WEBHOOK] ✅ Order marked as paid: ${orderId}`);

  // For paid trial orders, create subscription in Razorpay and database
  if (payment.paymentType === "trial" && payment.plan.planId) {
    console.log(`[WEBHOOK] Creating subscription for paid trial...`);

    try {
      // Check if subscription already exists
      const existingSubscription = await prisma.userSubscription.findFirst({
        where: {
          userId: payment.userId,
          planId: payment.planId,
          status: {
            in: ["pending", "trial", "active"],
          },
        },
      });

      if (existingSubscription) {
        console.log(`[WEBHOOK] Subscription already exists: ${existingSubscription.id}`);
        return;
      }

      // Create subscription in Razorpay
      const { createGatewaySubscription } = await import("@/lib/payment-gateway");
      const gatewaySubscription = await createGatewaySubscription({
        planId: payment.plan.planId,
        totalCount: 120,
        customerNotify: true,
        notes: {
          userId: payment.userId,
          planId: payment.planId,
          paidTrialOrderId: orderId,
        },
      });

      console.log(`[WEBHOOK] Razorpay subscription created: ${gatewaySubscription.id}`);

      // Create subscription record
      const subscription = await prisma.userSubscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          subscriptionId: gatewaySubscription.id,
          status: "pending",
          isTrial: true,
        },
      });

      console.log(`[WEBHOOK] ✅ Subscription created for paid trial: ${subscription.id}`);
    } catch (error) {
      console.error(`[WEBHOOK] ❌ Failed to create subscription:`, error);
    }
  }
};

/**
 * Handle invoice.generated event
 */
export const handleInvoiceGenerated = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const invoiceId = invoiceEntity.id;
  const subscriptionId = invoiceEntity.subscription_id;

  // Find subscription
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
  });

  if (!subscription) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Create payment record for this invoice
  console.log(`[WEBHOOK] Creating payment record for invoice...`);
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      planId: subscription.planId,
      invoiceId,
      userSubscriptionId: subscription.id, // Use internal DB ID
      gatewaySubscriptionId: invoiceEntity.subscription_id, // Store Razorpay subscription ID
      amount: invoiceEntity.amount,
      currency: invoiceEntity.currency,
      paymentType: "recurring",
      status: "pending",
      eventType: "invoice.generated",
    },
  });
  console.log(`[WEBHOOK] Payment record created for invoice: ${invoiceId}`);

  console.log(`Invoice generated: ${invoiceId}`);
};

/**
 * Handle invoice.paid event
 */
export const handleInvoicePaid = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const paymentEntity = payload.payload.payment.entity;
  const invoiceId = invoiceEntity.id;

  console.log(`[WEBHOOK] 🎯 invoice.paid - Invoice ID: ${invoiceId}`);
  console.log(`[WEBHOOK] Invoice details:`, {
    subscriptionId: invoiceEntity.subscription_id,
    amount: invoiceEntity.amount_paid,
    paymentId: paymentEntity.id,
  });

  // Find payment record
  const payment = await prisma.payment.findFirst({
    where: { invoiceId },
  });

  if (!payment) {
    console.error(`[WEBHOOK] ❌ Payment not found for invoice: ${invoiceId}`);
    return;
  }
  console.log(`[WEBHOOK] Payment record found in DB:`, payment.id);

  // Check idempotency
  if (payment.isWebhookProcessed && payment.eventType === "invoice.paid") {
    console.log(`Invoice already processed: ${invoiceId}`);
    return;
  }

  // Update payment
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "paid",
      paymentId: paymentEntity.id,
      paymentMethod: paymentEntity.method,
      isWebhookProcessed: true,
      eventType: "invoice.paid",
    },
  });

  // Update subscription status
  const subscription = await prisma.userSubscription.findFirst({
    where: { subscriptionId: invoiceEntity.subscription_id },
  });

  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "active",
        isTrial: false, // Trial ended if it was active
        currentPeriodStart: invoiceEntity.period_start
          ? new Date(invoiceEntity.period_start * 1000)
          : undefined,
        currentPeriodEnd: invoiceEntity.period_end
          ? new Date(invoiceEntity.period_end * 1000)
          : undefined,
        graceUntil: null, // Clear grace period if it was set
      },
    });
  }

  console.log(`Invoice paid: ${invoiceId}`);
};

/**
 * Handle invoice.payment_failed event
 */
export const handleInvoicePaymentFailed = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const invoiceId = invoiceEntity.id;

  // Find payment record
  const payment = await prisma.payment.findFirst({
    where: { invoiceId },
  });

  if (!payment) {
    console.error(`Payment not found for invoice: ${invoiceId}`);
    return;
  }

  // Update payment
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "failed",
      isWebhookProcessed: true,
      eventType: "invoice.payment_failed",
      metadata: {
        error: invoiceEntity.error_reason,
      },
    },
  });

  // Update subscription to past_due and set grace period
  const subscription = await prisma.userSubscription.findFirst({
    where: { subscriptionId: invoiceEntity.subscription_id },
  });

  if (subscription) {
    const graceUntil = new Date();
    graceUntil.setDate(graceUntil.getDate() + 7); // 7 days grace period

    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "past_due",
        graceUntil,
      },
    });

    // TODO: Send notification to user
    console.log(
      `Payment failed for subscription: ${subscription.id}, grace period until: ${graceUntil}`
    );
  }

  console.log(`Invoice payment failed: ${invoiceId}`);
};

/**
 * Handle subscription.cancelled event
 */
export const handleSubscriptionCancelled = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;

  // Find subscription
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
  });

  if (!subscription) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Update subscription status
  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "cancelled",
      currentPeriodEnd: subscriptionEntity.ended_at
        ? new Date(subscriptionEntity.ended_at * 1000)
        : new Date(),
    },
  });

  console.log(`Subscription cancelled: ${subscriptionId}`);
};

/**
 * Handle subscription.halted event
 */
export const handleSubscriptionHalted = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;

  // Find subscription
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
  });

  if (!subscription) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Update subscription status
  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "halted",
    },
  });

  console.log(`Subscription halted: ${subscriptionId}`);
};

/**
 * Handle subscription.charged event
 */
export const handleSubscriptionCharged = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const paymentEntity = payload.payload.payment.entity;
  const subscriptionId = subscriptionEntity.id;

  // Find subscription
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
  });

  if (!subscription) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Create payment record
  console.log(`[WEBHOOK] Creating payment record for subscription charge...`);
  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      planId: subscription.planId,
      userSubscriptionId: subscription.id, // Use internal DB ID, not Razorpay subscription ID
      gatewaySubscriptionId: subscriptionEntity.id, // Store Razorpay subscription ID
      paymentId: paymentEntity.id,
      amount: paymentEntity.amount,
      currency: paymentEntity.currency,
      paymentMethod: paymentEntity.method,
      paymentType: "recurring",
      status: "paid",
      isWebhookProcessed: true,
      eventType: "subscription.charged",
    },
  });
  console.log(`[WEBHOOK] Payment record created for recurring charge`);

  // Update subscription
  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "active",
      currentPeriodStart: subscriptionEntity.current_start
        ? new Date(subscriptionEntity.current_start * 1000)
        : undefined,
      currentPeriodEnd: subscriptionEntity.current_end
        ? new Date(subscriptionEntity.current_end * 1000)
        : undefined,
      nextBillingAt: subscriptionEntity.charge_at
        ? new Date(subscriptionEntity.charge_at * 1000)
        : undefined,
    },
  });

  console.log(`Subscription charged: ${subscriptionId}`);
};

// ==================== WEBHOOK ROUTER ====================

/**
 * Process webhook event
 * Routes to appropriate handler based on event type
 */
export const processWebhook = async (event: string, payload: any): Promise<void> => {
  console.log(`Processing webhook event: ${event}`);

  switch (event) {
    case "subscription.authenticated":
      await handleSubscriptionAuthenticated(payload);
      break;

    case "subscription.activated":
      await handleSubscriptionActivated(payload);
      break;

    case "order.paid":
      await handleOrderPaid(payload);
      break;

    case "invoice.generated":
      await handleInvoiceGenerated(payload);
      break;

    case "invoice.paid":
      await handleInvoicePaid(payload);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(payload);
      break;

    case "subscription.cancelled":
      await handleSubscriptionCancelled(payload);
      break;

    case "subscription.halted":
      await handleSubscriptionHalted(payload);
      break;

    case "subscription.charged":
      await handleSubscriptionCharged(payload);
      break;

    default:
      console.log(`Unhandled webhook event: ${event}`);
  }
};
