import { Request, Response, NextFunction } from "express";
import { hasActiveSubscription } from "../services/subscription.service";
import { hasAccess } from "../services/entitlement.service";

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

/**
 * Middleware to check if user has access to a specific course
 */
export const requireCourseAccess = (courseIdParam: string = "id") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const courseId = req.params[courseIdParam];

      if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      const access = await hasAccess(userId, "COURSE", courseId);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this course. Purchase required.",
          code: "ACCESS_DENIED"
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user has access to a specific category
 */
export const requireCategoryAccess = (categoryIdParam: string = "categoryId") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const categoryId = req.params[categoryIdParam];

      if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      const access = await hasAccess(userId, "CATEGORY", categoryId);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: "Category subscription required to access this content.",
          code: "ACCESS_DENIED"
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
