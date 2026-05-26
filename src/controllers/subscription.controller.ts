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
  cancelPendingSubscriptionById,
  verifyGooglePlayReceipt,
  acknowledgeGooglePlayPurchase,
  getAllSubscriptions,
  grantManualSubscription,
  verifySubscription,
} from "@/services/subscription.service";
import { GooglePlayReceipt } from "@/lib/types";
import { SubscriptionStatus } from "@/prisma/generated/prisma/client";

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

/**
 * Verify paid trial subscription
 * POST /api/subscriptions/verify
 * Authenticated
 */
export const verifySubscriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subscriptionId, paymentId, signature } = req.body;
    const userId = req.user!.id;

    if (!subscriptionId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "subscriptionId, paymentId, and signature are required",
      });
    }

    const subscription = await verifySubscription(userId, subscriptionId, paymentId, signature);

    return res.status(200).json({
      success: true,
      message: "Subscription verified and activated successfully.",
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
 * Cancel a specific pending subscription by ID
 * DELETE /api/subscriptions/:id/pending
 */
export const cancelPendingSubscriptionByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await cancelPendingSubscriptionById(userId, id);

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

// ==================== ADMIN: GET ALL SUBSCRIPTIONS ====================

const VALID_STATUSES: SubscriptionStatus[] = [
  "pending", "trial", "active", "past_due", "cancelled", "halted", "expired",
];

/**
 * Get all user subscriptions (admin)
 * GET /api/subscriptions/admin/all?page=1&limit=20&status=active
 * Authenticated + Admin
 */
export const getAllSubscriptionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status as SubscriptionStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const result = await getAllSubscriptions(
      page,
      limit,
      status as SubscriptionStatus | undefined,
      search
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin: Grant manual subscription (Cash/Offline payment)
 * POST /api/subscriptions/admin/grant-manual
 * Authenticated + Admin
 */
export const grantManualSubscriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, planId, amount, expiryDate, notes } = req.body;

    if (!userId || !planId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Plan ID are required",
      });
    }

    const subscription = await grantManualSubscription(userId, planId, {
      amount,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription granted manually",
      data: subscription,
    });
  } catch (error: any) {
    next(error);
  }
};