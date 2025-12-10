import { prisma } from "@/lib/db";
import { SubscriptionStatus } from "@/prisma/generated/prisma/client";

// ==================== WEBHOOK EVENT HANDLERS ====================

/**
 * subscription.authenticated - User completed payment (for paid trial addon)
 * This ONLY fires when there's an addon (paid trial)
 * Free trials skip this and go straight to activated
 */
export const handleSubscriptionAuthenticated = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;
  const notes = subscriptionEntity.notes || {};

  console.log(`[WEBHOOK] 🔵 AUTHENTICATED webhook received for: ${subscriptionId}`);
  console.log(`[WEBHOOK] Notes:`, notes);

  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.error(`[WEBHOOK] ❌ Subscription not found: ${subscriptionId}`);
    return;
  }

  console.log(
    `[WEBHOOK] Found subscription - Plan trialFee: ${subscription.plan.trialFee}, trialDays: ${subscription.plan.trialDays}`
  );

  // This webhook only fires for paid trials (addon payment)
  // Check if this was a paid trial
  const isPaidTrial = notes.subscriptionType === "paid_trial" || subscription.plan.trialFee > 0;

  console.log(
    `[WEBHOOK] isPaidTrial check: ${isPaidTrial} (notes.subscriptionType: ${notes.subscriptionType}, plan.trialFee: ${subscription.plan.trialFee})`
  );

  if (!isPaidTrial) {
    console.log(`[WEBHOOK] ⚠️ Not a paid trial, skipping authenticated handler`);
    return;
  }

  // Calculate trial end date
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + subscription.plan.trialDays);

  console.log(`[WEBHOOK] Setting trialEndsAt to: ${trialEndsAt.toISOString()}`);

  // Update subscription status to trial, mark addon payment as paid, and set hasUsedTrial
  await Promise.all([
    prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "trial" as SubscriptionStatus,
        trialEndsAt,
      },
    }),
    prisma.payment.updateMany({
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
    }),
    prisma.user.update({
      where: { id: subscription.userId },
      data: { hasUsedTrial: true },
    }),
  ]);

  console.log(
    `[WEBHOOK] ✅ Paid trial addon completed, status set to trial with trialEndsAt: ${trialEndsAt.toISOString()}, hasUsedTrial set to true`
  );
};

/**
 * subscription.activated - Subscription becomes active
 * Fires for ALL subscription types:
 * 1. Direct subscription (no trial) → status: "active"
 * 2. Free trial → status: "trial"
 * 3. Paid trial (after addon payment) → status: "trial"
 */
export const handleSubscriptionActivated = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscriptionId = subscriptionEntity.id;
  const notes = subscriptionEntity.notes || {};

  console.log(`[WEBHOOK] 🟢 ACTIVATED webhook received for: ${subscriptionId}`);
  console.log(`[WEBHOOK] Notes:`, notes);

  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.error(`[WEBHOOK] ❌ Subscription not found: ${subscriptionId}`);
    return;
  }

  console.log(
    `[WEBHOOK] Current subscription status: ${subscription.status}, trialEndsAt: ${subscription.trialEndsAt}`
  );

  const subscriptionType = notes.subscriptionType || "direct";
  const hasTrial = subscription.plan.trialDays > 0;

  console.log(`[WEBHOOK] subscriptionType: ${subscriptionType}, hasTrial: ${hasTrial}`);

  // Skip if already in trial/active (already processed by subscription.authenticated)
  if (subscriptionType === "paid_trial" && subscription.status === "trial") {
    console.log(`[WEBHOOK] ⚠️ Paid trial already in trial status, skipping activation`);
    return;
  }

  // Calculate trial end date if applicable
  let trialEndsAt: Date | undefined;
  if (hasTrial) {
    // For paid trial: calculate from addon payment date
    if (subscriptionType === "paid_trial") {
      const trialPayment = await prisma.payment.findFirst({
        where: {
          userSubscriptionId: subscription.id,
          paymentType: "trial",
          status: "paid",
        },
        orderBy: { createdAt: "desc" },
      });

      if (trialPayment) {
        trialEndsAt = new Date(trialPayment.createdAt);
        trialEndsAt.setDate(trialEndsAt.getDate() + subscription.plan.trialDays);
      }
    } else {
      // For free trial: calculate from now (activation time)
      trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + subscription.plan.trialDays);
    }
  }

  // Determine final status
  let finalStatus: SubscriptionStatus;
  if (hasTrial) {
    finalStatus = "trial"; // Both free and paid trials
  } else {
    finalStatus = "active"; // Direct subscription, no trial
  }

  console.log(
    `[WEBHOOK] Setting status to: ${finalStatus}, trialEndsAt: ${trialEndsAt?.toISOString() || "null"
    }`
  );

  // Update subscription and set hasUsedTrial if entering trial
  await Promise.all([
    prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: finalStatus,
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
    }),
    // Set hasUsedTrial if this is a trial subscription
    ...(finalStatus === "trial"
      ? [
        prisma.user.update({
          where: { id: subscription.userId },
          data: { hasUsedTrial: true },
        }),
      ]
      : []),
  ]);

  console.log(
    `[WEBHOOK] ✅ Subscription activated: ${subscriptionId}, type: ${subscriptionType}, status: ${finalStatus}, trialEndsAt: ${trialEndsAt?.toISOString() || "null"
    }${finalStatus === "trial" ? ", hasUsedTrial set to true" : ""}`
  );
};

/**
 * invoice.generated - Create payment record for upcoming charge
 */
export const handleInvoiceGenerated = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const subscriptionId = invoiceEntity.subscription_id;

  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId },
  });

  if (!subscription) {
    console.error(`[WEBHOOK] Subscription not found: ${subscriptionId}`);
    return;
  }

  await prisma.payment.create({
    data: {
      userId: subscription.userId,
      planId: subscription.planId,
      invoiceId: invoiceEntity.id,
      userSubscriptionId: subscription.id,
      gatewaySubscriptionId: subscriptionId,
      amount: invoiceEntity.amount,
      currency: invoiceEntity.currency,
      paymentType: "recurring",
      status: "pending",
      eventType: "invoice.generated",
    },
  });

  console.log(`[WEBHOOK] Invoice generated: ${invoiceEntity.id}`);
};

/**
 * invoice.paid - Payment successful, update subscription to active
 */
export const handleInvoicePaid = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const paymentEntity = payload.payload.payment.entity;
  const invoiceId = invoiceEntity.id;

  const payment = await prisma.payment.findFirst({ where: { invoiceId } });

  if (!payment) {
    console.error(`[WEBHOOK] Payment not found: ${invoiceId}`);
    return;
  }

  if (payment.isWebhookProcessed && payment.eventType === "invoice.paid") {
    return; // Already processed
  }

  const subscription = await prisma.userSubscription.findFirst({
    where: { subscriptionId: invoiceEntity.subscription_id },
  });

  await Promise.all([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        paymentId: paymentEntity.id,
        paymentMethod: paymentEntity.method,
        isWebhookProcessed: true,
        eventType: "invoice.paid",
      },
    }),
    subscription
      ? prisma.userSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "active",
          isTrial: false,
          currentPeriodStart: invoiceEntity.period_start
            ? new Date(invoiceEntity.period_start * 1000)
            : undefined,
          currentPeriodEnd: invoiceEntity.period_end
            ? new Date(invoiceEntity.period_end * 1000)
            : undefined,
          graceUntil: null,
        },
      })
      : Promise.resolve(),
  ]);

  console.log(`[WEBHOOK] Invoice paid: ${invoiceId}`);
};

/**
 * invoice.payment_failed - Payment failed, set grace period
 */
export const handleInvoicePaymentFailed = async (payload: any): Promise<void> => {
  const invoiceEntity = payload.payload.invoice.entity;
  const invoiceId = invoiceEntity.id;

  const payment = await prisma.payment.findFirst({ where: { invoiceId } });
  if (!payment) return;

  const subscription = await prisma.userSubscription.findFirst({
    where: { subscriptionId: invoiceEntity.subscription_id },
  });

  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 7);

  await Promise.all([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "failed",
        isWebhookProcessed: true,
        eventType: "invoice.payment_failed",
        metadata: { error: invoiceEntity.error_reason },
      },
    }),
    subscription
      ? prisma.userSubscription.update({
        where: { id: subscription.id },
        data: { status: "past_due", graceUntil },
      })
      : Promise.resolve(),
  ]);

  console.log(`[WEBHOOK] Payment failed: ${invoiceId}, grace until ${graceUntil}`);
};

/**
 * payment.failed - Standalone payment failure (for addon payments)
 * This handles addon payment failures (like trial fee payment declined)
 */
export const handlePaymentFailed = async (payload: any): Promise<void> => {
  const paymentEntity = payload.payload.payment.entity;
  const paymentId = paymentEntity.id;
  const notes = paymentEntity.notes || {};

  // Find payment record by payment ID or by subscription
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { paymentId: paymentId },
        {
          gatewaySubscriptionId: paymentEntity.subscription_id,
          status: "pending",
          paymentType: "trial",
        },
      ],
    },
    include: {
      userSubscription: true,
    },
  });

  if (!payment) {
    console.log(`[WEBHOOK] Payment record not found for: ${paymentId}`);
    return;
  }

  // Update payment status to failed
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "failed",
      paymentId: paymentId,
      isWebhookProcessed: true,
      eventType: "payment.failed",
      metadata: {
        ...((payment.metadata as any) || {}),
        error: paymentEntity.error_description,
        errorCode: paymentEntity.error_code,
        errorReason: paymentEntity.error_reason,
      },
    },
  });

  console.log(`[WEBHOOK] Payment failed: ${paymentId}, reason: ${paymentEntity.error_description}`);
};

/**
 * subscription.cancelled - Subscription cancelled by user or system
 */
export const handleSubscriptionCancelled = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId: subscriptionEntity.id },
  });

  if (!subscription) return;

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "cancelled",
      currentPeriodEnd: subscriptionEntity.ended_at
        ? new Date(subscriptionEntity.ended_at * 1000)
        : new Date(),
    },
  });

  console.log(`[WEBHOOK] Subscription cancelled: ${subscriptionEntity.id}`);
};

/**
 * subscription.halted - Subscription halted due to failed payments
 */
export const handleSubscriptionHalted = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId: subscriptionEntity.id },
  });

  if (!subscription) return;

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { status: "halted" },
  });

  console.log(`[WEBHOOK] Subscription halted: ${subscriptionEntity.id}`);
};

/**
 * subscription.charged - Recurring payment successful
 */
export const handleSubscriptionCharged = async (payload: any): Promise<void> => {
  const subscriptionEntity = payload.payload.subscription.entity;
  const paymentEntity = payload.payload.payment.entity;

  const subscription = await prisma.userSubscription.findUnique({
    where: { subscriptionId: subscriptionEntity.id },
  });

  if (!subscription) return;

  await Promise.all([
    prisma.payment.create({
      data: {
        userId: subscription.userId,
        planId: subscription.planId,
        userSubscriptionId: subscription.id,
        gatewaySubscriptionId: subscriptionEntity.id,
        paymentId: paymentEntity.id,
        amount: paymentEntity.amount,
        currency: paymentEntity.currency,
        paymentMethod: paymentEntity.method,
        paymentType: "recurring",
        status: "paid",
        isWebhookProcessed: true,
        eventType: "subscription.charged",
      },
    }),
    prisma.userSubscription.update({
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
    }),
  ]);

  console.log(`[WEBHOOK] Recurring charge: ${subscriptionEntity.id}`);
};

// ==================== WEBHOOK ROUTER ====================

/**
 * Process webhook event - Routes to appropriate handler
 */
export const processWebhook = async (event: string, payload: any): Promise<void> => {
  const handlers: Record<string, (payload: any) => Promise<void>> = {
    "subscription.authenticated": handleSubscriptionAuthenticated,
    "subscription.activated": handleSubscriptionActivated,
    "payment.failed": handlePaymentFailed,
    "invoice.generated": handleInvoiceGenerated,
    "invoice.paid": handleInvoicePaid,
    "invoice.payment_failed": handleInvoicePaymentFailed,
    "subscription.cancelled": handleSubscriptionCancelled,
    "subscription.halted": handleSubscriptionHalted,
    "subscription.charged": handleSubscriptionCharged,
  };

  const handler = handlers[event];
  if (handler) {
    await handler(payload);
  } else {
    console.log(`[WEBHOOK] Unhandled event: ${event}`);
  }
};

export const processRTDN = async (notification: any): Promise<void> => {

  const { subscriptionNotification } = notification;
  if (!subscriptionNotification) {
    console.log(`[RTDN] Unhandled notification type`);
    return;
  }

  const handlers: Record<number, (payload: any) => Promise<void>> = {

    2: handleSubscriptionActivated, //Subscription renewed
    3: handleSubscriptionCancelled, //Subscription cancelled
    4: handleSubscriptionAuthenticated, //Subscription purchased : in case it is faster than mannual webhook
    6: handleSubscriptionCharged, // Susbscription is in grace period : do nothing
    5: handleSubscriptionHalted, //Subscription on hold  ; after grace period unable to pay
    // 1 : Subscription recovered after grace period : not handled
    //13 : subscription expiry 
  };

  const handler = handlers[subscriptionNotification.notificationType];
  if (handler) {
    await handler(notification);
  } else {
    console.log(`[WEBHOOK] Unhandled event: ${subscriptionNotification.notificationType}`);
  }
};