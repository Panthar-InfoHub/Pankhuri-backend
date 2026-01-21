import { Request, Response, NextFunction } from "express";
import { initiateCoursePurchase, verifyCoursePurchase } from "@/services/purchase.service";

/**
 * Initiate Course Purchase
 * POST /api/purchases/course
 */
export const initiateCoursePurchaseHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { courseId } = req.body;
        const userId = req.user?.id;

        if (!courseId) {
            return res.status(400).json({ success: false, message: "Course ID is required" });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const data = await initiateCoursePurchase(userId, courseId);

        return res.status(200).json({
            success: true,
            message: "Course purchase initiated",
            data
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Verify Course Purchase
 * POST /api/purchases/course/verify
 */
export const verifyCoursePurchaseHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId, paymentId, signature } = req.body;
        const userId = req.user?.id;

        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({ success: false, message: "Missing required verification data" });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const entitlement = await verifyCoursePurchase(userId, orderId, paymentId, signature);

        return res.status(200).json({
            success: true,
            message: "Course purchase verified successfully",
            data: entitlement
        });
    } catch (error: any) {
        next(error);
    }
};
