/**
 * Subscription Controller
 * Handles user subscription HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import {
  initiateSubscription,
  verifyPaidTrialPayment,
  getUserActiveSubscription,
  getSubscriptionById,
  getUserSubscriptions,
  cancelAtPeriodEnd,
  cancelImmediately,
  syncSubscriptionFromGateway,
} from "@/services/subscription.service";
import { verifyPaymentSignature } from "@/lib/payment-gateway";

// ==================== INITIATE SUBSCRIPTION ====================

/**
 * Initiate subscription for a user
 * POST /api/subscriptions
 * Authenticated
 */
export const initiateSubscriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId } = req.body;
    const userId = req.user!.id;

    console.log(`[CONTROLLER] POST /api/subscriptions - User: ${userId}, Plan: ${planId}`);

    // Validation
    if (!planId) {
      console.log(`[CONTROLLER] ❌ Validation failed: Plan ID missing`);
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const result = await initiateSubscription(userId, planId);

    if (result.requiresPayment) {
      // Paid trial - return order details for frontend checkout
      console.log(`[CONTROLLER] ✅ Returning payment details for frontend checkout`);
      return res.status(200).json({
        success: true,
        message: "Payment required for trial",
        data: {
          requiresPayment: true,
          orderId: result.orderId,
          amount: result.amount,
          currency: result.currency,
          keyId: result.keyId,
        },
      });
    }

    // Free trial or no trial - subscription created
    console.log(
      `[CONTROLLER] ✅ Subscription created successfully. ID: ${result.subscription?.id}`
    );
    return res.status(201).json({
      success: true,
      message: "Subscription initiated successfully",
      data: {
        requiresPayment: false,
        subscription: result.subscription,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== VERIFY PAID TRIAL PAYMENT ====================

/**
 * Verify paid trial payment
 * POST /api/subscriptions/verify-trial-payment
 * Authenticated
 */
export const verifyPaidTrialPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const userId = req.user!.id;

    console.log(`[CONTROLLER] POST /api/subscriptions/verify-trial-payment - User: ${userId}`);
    console.log(`[CONTROLLER] Payment details:`, { orderId, paymentId });

    // Validation
    if (!orderId || !paymentId || !signature) {
      console.log(`[CONTROLLER] ❌ Validation failed: Missing required fields`);
      return res.status(400).json({
        success: false,
        message: "Order ID, payment ID, and signature are required",
      });
    }

    // Verify signature
    console.log(`[CONTROLLER] Verifying Razorpay signature...`);
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Create subscription
    const subscription = await verifyPaidTrialPayment(userId, orderId, paymentId);

    return res.status(200).json({
      success: true,
      message: "Payment verified and subscription created successfully",
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== GET SUBSCRIPTIONS ====================

/**
 * Get user's active subscription
 * GET /api/subscriptions/active
 * Authenticated
 */
export const getActiveSubscriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;

    const subscription = await getUserActiveSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get subscription by ID
 * GET /api/subscriptions/:id
 * Authenticated
 */
export const getSubscriptionByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const subscription = await getSubscriptionById(id);

    // Verify ownership
    if (subscription.userId !== userId && req.user!.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to subscription",
      });
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all user subscriptions (history)
 * GET /api/subscriptions
 * Authenticated
 */
export const getUserSubscriptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;

    const subscriptions = await getUserSubscriptions(userId);

    return res.status(200).json({
      success: true,
      data: subscriptions,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== CANCEL SUBSCRIPTION ====================

/**
 * Cancel subscription at period end
 * POST /api/subscriptions/:id/cancel
 * Authenticated
 */
export const cancelAtPeriodEndHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const subscription = await cancelAtPeriodEnd(userId, id);

    return res.status(200).json({
      success: true,
      message: "Subscription will be cancelled at the end of the current period",
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Cancel subscription immediately
 * POST /api/subscriptions/:id/cancel-immediately
 * Authenticated
 */
export const cancelImmediatelyHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const subscription = await cancelImmediately(userId, id);

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled immediately",
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SYNC SUBSCRIPTION ====================

/**
 * Sync subscription from payment gateway
 * POST /api/subscriptions/:id/sync
 * Admin only
 */
export const syncSubscriptionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await syncSubscriptionFromGateway(id);

    return res.status(200).json({
      success: true,
      message: "Subscription synced from payment gateway successfully",
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};
