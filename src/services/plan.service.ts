/**
 * Plan Service
 * Handles subscription plan management
 */

import { prisma } from "@/lib/db";
import { SubscriptionPlan, Prisma } from "@/prisma/generated/prisma/client";
import { createGatewayPlan } from "@/lib/payment-gateway";

// ==================== CREATE PLAN ====================

/**
 * Create a new subscription plan
 * 1. Create in database first
 * 2. Sync to payment gateway
 * 3. Update DB with gateway's plan ID
 */
export const createPlan = async (
    planData: Prisma.SubscriptionPlanCreateInput
): Promise<SubscriptionPlan> => {
    // Step 1: Create plan in database
    const plan = await prisma.subscriptionPlan.create({
        data: planData,
    });

    // Lifetime plans are one-time payments and don't need a Gateway Plan (recurring template)
    if (plan.subscriptionType === 'lifetime') {
        console.log(`[PLAN] Lifetime plan created locally for ${plan.name}. Skipping gateway sync.`);
        return plan;
    }

    try {
        // Step 2: Create plan in payment gateway for RECURRING billing
        const gatewayPlan = await createGatewayPlan({
            name: plan.name,
            amount: plan.price,
            currency: plan.currency,
            // period needs to be 'monthly' or 'yearly' for Razorpay
            period: plan.subscriptionType as "monthly" | "yearly",
            interval: 1,
            description: plan.description || undefined,
        });

        // Step 3: Update plan with gateway's plan ID
        const updatedPlan = await prisma.subscriptionPlan.update({
            where: { id: plan.id },
            data: {
                planId: gatewayPlan.id,
            },
        });

        return updatedPlan;
    } catch (error: any) {
        // Rollback: Delete plan from database if gateway creation fails
        await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
        throw new Error(`Failed to create plan in payment gateway: ${error.message}`);
    }
};

// ==================== GET PLANS ====================

/**
 * Get plan by slug (for frontend)
 */
export const getPlanBySlug = async (slug: string): Promise<SubscriptionPlan> => {
    const plan = await prisma.subscriptionPlan.findUnique({
        where: { slug, isActive: true },
    });

    if (!plan) {
        throw new Error("Plan not found");
    }

    return plan;
};

/**
 * Get plan by ID
 */
export const getPlanById = async (id: string): Promise<SubscriptionPlan> => {
    const plan = await prisma.subscriptionPlan.findUnique({
        where: { id },
    });

    if (!plan) {
        throw new Error("Plan not found");
    }

    return plan;
};

/**
 * Get all active plans
 */
export const getActivePlans = async (): Promise<SubscriptionPlan[]> => {
    return await prisma.subscriptionPlan.findMany({
        where: {
            isActive: true,
        },
        orderBy: {
            order: "asc",
        },
    });
};

// ==================== UPDATE PLAN ====================

/**
 * Update plan (non-price fields only)
 * For price changes, create a new plan instead
 */
export const updatePlan = async (
    id: string,
    updates: Prisma.SubscriptionPlanUpdateInput
): Promise<SubscriptionPlan> => {
    // Don't allow price updates
    if (updates.price || updates.discountedPrice) {
        throw new Error(
            "Cannot update plan price. Create a new plan instead to preserve existing subscriptions."
        );
    }

    return await prisma.subscriptionPlan.update({
        where: { id },
        data: {
            ...updates,
            updatedAt: new Date(),
        },
    });
};

// ==================== DELETE PLAN ====================

/**
 * Delete plan (soft delete - mark as inactive)
 */
export const deletePlan = async (id: string): Promise<SubscriptionPlan> => {
    // Check if plan has active subscriptions
    const activeSubscriptions = await prisma.userSubscription.count({
        where: {
            planId: id,
            status: {
                in: ["pending", "trial", "active", "past_due"],
            },
        },
    });

    if (activeSubscriptions > 0) {
        throw new Error(
            "Cannot delete plan with active subscriptions. Mark as inactive instead."
        );
    }

    return await prisma.subscriptionPlan.update({
        where: { id },
        data: { isActive: false },
    });
};

