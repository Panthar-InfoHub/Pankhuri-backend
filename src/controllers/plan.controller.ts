/**
 * Plan Controller
 * Handles subscription plan HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import {
    createPlan,
    getPlanBySlug,
    getPlanById,
    getActivePlans,
    getAllPlans,
    updatePlan,
    deletePlan,
    syncPlanToGateway,
} from "@/services/plan.service";
import { Prisma } from "@/prisma/generated/prisma/client";

// ==================== CREATE PLAN ====================

/**
 * Create a new subscription plan
 * POST /api/plans
 * Admin only
 */
export const createPlanHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            name,
            slug,
            description,
            subscriptionType,
            price,
            discountedPrice,
            currency,
            billingInterval,
            trialDays,
            isPaidTrial,
            trialFee,
            features,
            order,
        } = req.body;

        // Validation
        if (!name || !slug || !price || !billingInterval || !subscriptionType) {
            return res.status(400).json({
                success: false,
                message: "Name, slug, price, billingInterval, and subscriptionType are required",
            });
        }

        const planData: Prisma.SubscriptionPlanCreateInput = {
            name,
            slug,
            description,
            subscriptionType,
            price,
            discountedPrice,
            currency: currency || "INR",
            billingInterval,
            trialDays,
            isPaidTrial: isPaidTrial || false,
            trialFee,
            features,
            order,
            isActive: true,
        };

        const plan = await createPlan(planData);

        return res.status(201).json({
            success: true,
            message: "Plan created successfully",
            data: plan,
        });
    } catch (error: any) {
        next(error);
    }
};

// ==================== GET PLANS ====================

/**
 * Get all active plans
 * GET /api/plans
 * Public
 */
export const getActivePlansHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const plans = await getActivePlans();

        return res.status(200).json({
            success: true,
            data: plans,
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Get all plans (including inactive)
 * GET /api/plans/all
 * Admin only
 */
export const getAllPlansHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const plans = await getAllPlans();

        return res.status(200).json({
            success: true,
            data: plans,
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Get plan by slug
 * GET /api/plans/slug/:slug
 * Public
 */
export const getPlanBySlugHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { slug } = req.params;

        const plan = await getPlanBySlug(slug);

        return res.status(200).json({
            success: true,
            data: plan,
        });
    } catch (error: any) {
        next(error);
    }
};

/**
 * Get plan by ID
 * GET /api/plans/:id
 * Admin only
 */
export const getPlanByIdHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        const plan = await getPlanById(id);

        return res.status(200).json({
            success: true,
            data: plan,
        });
    } catch (error: any) {
        next(error);
    }
};

// ==================== UPDATE PLAN ====================

/**
 * Update plan
 * PUT /api/plans/:id
 * Admin only
 */
export const updatePlanHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const plan = await updatePlan(id, updates);

        return res.status(200).json({
            success: true,
            message: "Plan updated successfully",
            data: plan,
        });
    } catch (error: any) {
        next(error);
    }
};

// ==================== DELETE PLAN ====================

/**
 * Delete plan
 * DELETE /api/plans/:id
 * Admin only
 */
export const deletePlanHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        const plan = await deletePlan(id);

        return res.status(200).json({
            success: true,
            message: "Plan deleted successfully",
            data: plan,
        });
    } catch (error: any) {
        next(error);
    }
};

// ==================== SYNC PLAN ====================

/**
 * Sync plan to payment gateway
 * POST /api/plans/:id/sync
 * Admin only
 */
export const syncPlanHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { id } = req.params;

        const gatewayPlan = await syncPlanToGateway(id);

        return res.status(200).json({
            success: true,
            message: "Plan synced to payment gateway successfully",
            data: gatewayPlan,
        });
    } catch (error: any) {
        next(error);
    }
};
