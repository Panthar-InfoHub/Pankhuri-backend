/**
 * Subscription Controller
 * Handles paid trial subscription HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import {
  initiateSubscription,
  getUserActiveSubscription,
  getSubscriptionById,
  getUserSubscriptions,
  cancelAtPeriodEnd,
  cancelImmediately,
  getUserSubscriptionStatus,
  cancelPendingSubscription,
  verifyGooglePlayReceipt,
  acknowledgeGooglePlayPurchase,
} from "@/services/subscription.service";
import { GooglePlayReceipt } from "@/lib/types";

// ==================== INITIATE SUBSCRIPTION ====================

/**
 * Initiate paid trial subscription
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

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const paymentInfo = await initiateSubscription(userId, planId);

    return res.status(200).json({
      success: true,
      message: "Subscription initiated. Complete payment to activate.",
      data: paymentInfo,
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

// ==================== PENDING SUBSCRIPTION MANAGEMENT ====================

/**
 * Get subscription status (including pending)
 * GET /api/subscriptions/status
 */
export const getSubscriptionStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const status = await getUserSubscriptionStatus(userId);

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Cancel pending subscription
 * DELETE /api/subscriptions/pending
 */
export const cancelPendingSubscriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    await cancelPendingSubscription(userId);

    return res.status(200).json({
      success: true,
      message: "Pending subscription cancelled successfully",
    });
  } catch (error: any) {
    next(error);
  }
};



/**
 * Initiate Google Play subscription
 * Authenticated
 */
export const handleGooglePlaySubscriptionCreate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    const userId = req.user!.id;


    if (!data.planId || !data.purchaseToken || !data.productId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: planId, productId, or purchaseToken",
      });
    }

    // Verify token with google play
    const receipt: GooglePlayReceipt = await verifyGooglePlayReceipt(data.purchaseToken, data.planId);

    const paymentInfo = await initiateSubscription(userId, data.planId, {
      ...data,
      receipt,
    });

    await acknowledgeGooglePlayPurchase(data.purchaseToken, data.productId);

    return res.status(200).json({
      success: true,
      message: "Subscription initiated. Complete payment to activate.",
      data: paymentInfo,
    });
  } catch (error: any) {
    next(error);
  }
};