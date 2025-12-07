import { Request, Response, NextFunction } from "express";
import { hasActiveSubscription } from "../services/subscription.service";

/**
 * Middleware to check if user has an active subscription
 * Blocks access if no active subscription
 * Use this for features that absolutely require subscription
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "UNAUTHORIZED",
      });
    }

    const hasSubscription = await hasActiveSubscription(req.user.id);

    if (!hasSubscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to access this content",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
