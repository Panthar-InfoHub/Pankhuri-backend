import { Request, Response, NextFunction } from "express";
import { cleanupExpiredResources } from "@services/entitlement.service";

/**
 * Cleanup expired entitlements and subscriptions
 * POST /api/scheduler/cleanup
 * Security: Requires x-scheduler-token header
 */
export const cleanupExpiredHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Security check: Only allow authorized requests from Google Cloud Scheduler
    const schedulerToken = req.headers["x-scheduler-token"];
    const secret = process.env.SCHEDULER_SECRET || "default_secret";

    if (schedulerToken !== secret) {
      console.warn(`[SECURITY] Unauthorized cleanup attempt`);
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or missing scheduler token",
      });
    }

    const { expiredEntitlements, expiredSubscriptions } = await cleanupExpiredResources();

    console.log(`[CLEANUP] Ran daily cleanup: ${expiredEntitlements} entitlements and ${expiredSubscriptions} subscriptions expired.`);

    return res.status(200).json({
      success: true,
      message: "Cleanup completed successfully",
      data: {
        expiredEntitlements,
        expiredSubscriptions
      },
    });
  } catch (error: any) {
    console.error("Error during scheduled cleanup:", error);
    next(error);
  }
};
