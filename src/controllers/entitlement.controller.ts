import { Request, Response, NextFunction } from "express";
import {
    getAllEntitlements,
    getEntitlementsByTarget,
    getUserActiveEntitlements,
    revokeEntitlement
} from "@/services/entitlement.service";
import { PlanType } from "@/prisma/generated/prisma/client";

/**
 * Get all entitlements (Admin)
 */
export const getAllEntitlementsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const data = await getAllEntitlements(page, limit);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Get users who have access to a specific target
 */
export const getTargetEntitlementsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, targetId } = req.query;

        if (!type || !targetId) {
            return res.status(400).json({
                success: false,
                message: "Type and targetId are required"
            });
        }

        const data = await getEntitlementsByTarget(type as PlanType, targetId as string);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Get current user's active entitlements
 */
export const getMyEntitlementsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const data = await getUserActiveEntitlements(userId);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Handle manual revocation of entitlement (Admin)
 */
export const revokeEntitlementHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId, type, targetId } = req.body;

        if (!userId || !type) {
            return res.status(400).json({ success: false, message: "UserId and type are required" });
        }

        const data = await revokeEntitlement(userId, type as PlanType, targetId);

        return res.status(200).json({
            success: true,
            message: "Entitlement revoked successfully",
            data
        });
    } catch (error: any) {
        next(error);
    }
};
