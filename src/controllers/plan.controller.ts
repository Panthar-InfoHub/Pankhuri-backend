/**
 * Plan Controller
 * Handles subscription plan HTTP requests
 */

import { prisma } from "@/lib/db";
import { Request, Response, NextFunction } from "express";
import {
  createPlan,
  getPlanBySlug,
  getPlanById,
  getActivePlans,
  updatePlan,
  deletePlan,
} from "@/services/plan.service";
import { PlanType, Prisma, SubscriptionType } from "@/prisma/generated/prisma/client";

// ==================== CREATE PLAN ====================

/**
 * Create a new subscription plan
 * POST /api/plans
 * Admin only
 */
export const createPlanHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      slug,
      description,
      subscriptionType,
      price,
      discountedPrice,
      currency,
      trialDays,
      trialFee,
      features,
      order,
      planType,
      targetId,
      planId, // Razorpay Plan ID
      provider, // razorpay | google_play
      deactivateOthers, // Optional: auto-deactivate old plan
    } = req.body;

    // Validation
    if (!name || !slug || !price || !subscriptionType) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, price, and subscriptionType are required",
      });
    }

    const effectiveProvider = provider || "razorpay";
    const effectivePlanType = planType || "WHOLE_APP";

    // 1. Courses must be Lifetime (One-time pay)
    if (effectivePlanType === "COURSE" && (subscriptionType === "monthly" || subscriptionType === "yearly")) {
      return res.status(400).json({
        success: false,
        message: "Course plans must be 'lifetime' (one-time payment) in the current version.",
      });
    }

    // 2. Category & App must be Subscriptions (Recurring)
    if ((effectivePlanType === "WHOLE_APP" || effectivePlanType === "CATEGORY") && subscriptionType === "lifetime") {
      return res.status(400).json({
        success: false,
        message: "App and Category plans must be recurring ('monthly' or 'yearly') in the current version.",
      });
    }

    // 3. Validate Target Existence
    if (effectivePlanType === "COURSE") {
      if (!targetId) {
        return res.status(400).json({ success: false, message: "targetId is required for COURSE plans" });
      }
      const course = await prisma.course.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!course) {
        return res.status(404).json({ success: false, message: `Course with ID ${targetId} not found` });
      }
    } else if (effectivePlanType === "CATEGORY") {
      if (!targetId) {
        return res.status(400).json({ success: false, message: "targetId is required for CATEGORY plans" });
      }
      const category = await prisma.category.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!category) {
        return res.status(404).json({ success: false, message: `Category with ID ${targetId} not found` });
      }
    }

    // 4. Enforce Uniqueness & Handle Deactivation
    const existingActivePlan = await prisma.subscriptionPlan.findFirst({
      where: {
        planType: effectivePlanType,
        targetId: targetId || null,
        subscriptionType: subscriptionType,
        isActive: true,
      },
    });

    if (existingActivePlan) {
      if (deactivateOthers) {
        // Soft-delete the old plan to make room for the new one
        await prisma.subscriptionPlan.update({
          where: { id: existingActivePlan.id },
          data: { isActive: false },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `An active ${subscriptionType} plan already exists for this ${effectivePlanType.toLowerCase()}. Deactivate it or use 'deactivateOthers' to replace it.`,
        });
      }
    }

    const planData: Prisma.SubscriptionPlanCreateInput = {
      name,
      slug,
      description,
      subscriptionType,
      price,
      discountedPrice,
      currency: currency || "INR",
      trialDays: trialDays || 0,
      trialFee: trialFee || 0,
      features,
      order,
      planType: effectivePlanType,
      targetId,
      planId,
      provider: effectiveProvider,
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
export const getActivePlansHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, subscription_type, targetId } = req.query;

    let planType: PlanType = "WHOLE_APP"; // Default

    if (type) {
      const typeStr = (type as string).toLowerCase();
      if (typeStr === 'category') {
        planType = "CATEGORY";
      } else if (typeStr === 'courses' || typeStr === 'course') {
        planType = "COURSE";
      } else if (typeStr === 'whole_app' || typeStr === 'whole app') {
        planType = "WHOLE_APP";
      }
    }

    const plans = await getActivePlans({
      plan_type: planType,
      subscription_type: subscription_type as SubscriptionType | undefined,
      target_id: targetId as string | undefined,
    });

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
export const getPlanBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
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
export const getPlanByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
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
export const updatePlanHandler = async (req: Request, res: Response, next: NextFunction) => {
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
export const deletePlanHandler = async (req: Request, res: Response, next: NextFunction) => {
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
