/**
 * Plan Service
 * Handles subscription plan management
 */

import { prisma } from "@/lib/db";
import { SubscriptionPlan, Prisma, PlanType, SubscriptionType, SubscriptionStatus } from "@/prisma/generated/prisma/client";
import { createGatewayPlan, cancelGatewaySubscription } from "@/lib/payment-gateway";

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
export const getActivePlans = async ({ plan_type, subscription_type, is_active, target_id }: { plan_type?: PlanType, subscription_type?: SubscriptionType, is_active?: boolean, target_id?: string }): Promise<SubscriptionPlan[]> => {

    const where: Prisma.SubscriptionPlanWhereInput = {
        planType: plan_type, // Now mandatory in the way we call it from controller, but service stays flexible
        ...(subscription_type && { subscriptionType: subscription_type }),
        ...(target_id && { targetId: target_id }),
        isActive: typeof is_active === "boolean" ? is_active : true,
    };
    return await prisma.subscriptionPlan.findMany({
        where,
        orderBy: {
            order: "asc",
        },
    });
};

// ==================== UPDATE PLAN ====================

/**
 * Update plan (Strict Whitelist)
 * Only allows updating display/metadata fields.
 * Billing & Architecture fields (price, type, targets) are IMMUTABLE.
 */
export const updatePlan = async (
    id: string,
    updates: any
): Promise<SubscriptionPlan> => {
    // 1. Define allowed fields for update (The Whitelist)
    const allowedFields = [
        "name",         // Display Name
        "slug",         // URL Slug
        "description",  // Marketing description
        "duration",     // UI display duration
        "features",     // JSON features list
        "isActive",     // Deactivate/Active toggle (Works regardless of subscribers)
        "order"         // Display order
    ];

    // 2. Filter updates to only allowed fields
    const filteredUpdates: any = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
        }
    }

    // 3. Check for forbidden fields and throw clear errors
    // These fields are tied to Razorpay Plan Templates or Core App Architecture
    const forbiddenFields = [
        "price",
        "discountedPrice",
        "currency",
        "subscriptionType",
        "planType",
        "targetId",
        "provider",
        "planId",
        "trialFee",
        "trialDays"
    ];

    for (const field of forbiddenFields) {
        if (updates[field] !== undefined) {
            throw new Error(`The field '${field}' is immutable. To change billing terms, pricing, or trial structure, you must create a NEW plan.`);
        }
    }

    if (Object.keys(filteredUpdates).length === 0) {
        throw new Error("No valid fields provided for update.");
    }

    return await prisma.subscriptionPlan.update({
        where: { id },
        data: {
            ...filteredUpdates,
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


// ==================== EMERGENCY DEACTIVATION ====================

/**
 * Deactivate all plans associated with a specific target (Course or Category)
 * This is called when a course or category is deleted.
 * 
 * DESIGN PRINCIPLE: 
 * 1. Mark Plans inactive immediately (prevents NEW sales).
 * 2. Loop through users: Cancel Gateway -> Execute DB updates in Transaction.
 * 3. If a user fails, we log it and continue (Resilience).
 */
export const deactivatePlansByTarget = async (targetId: string, planType: PlanType) => {
    console.log(`[PLAN] Starting atomic deactivation for ${planType}: ${targetId}`);

    // 1. Fetch all active plans for this target
    const plans = await prisma.subscriptionPlan.findMany({
        where: { targetId, planType, isActive: true }
    });

    if (plans.length === 0) return;

    // 2. Mark all plans inactive in the database first
    // This stops any concurrent checkouts from proceeding
    await prisma.subscriptionPlan.updateMany({
        where: { id: { in: plans.map(p => p.id) } },
        data: { isActive: false, updatedAt: new Date() }
    });

    for (const plan of plans) {
        // 3. Find all active/pending subscriptions
        const subscriptions = await prisma.userSubscription.findMany({
            where: {
                planId: plan.id,
                status: { in: ["pending", "trial", "active", "past_due"] }
            }
        });

        console.log(`[PLAN] Processing ${subscriptions.length} subscriptions for plan: ${plan.name}`);

        for (const sub of subscriptions) {
            try {
                // STEP A: Gateway Cancellation (External Side Effect)
                // We do this first. If it fails, the catch block skips the DB update.
                if (sub.subscriptionId && sub.provider === 'razorpay') {
                    await cancelGatewaySubscription(sub.subscriptionId, false);
                    console.log(`[PLAN] Gateway cancelled: ${sub.subscriptionId}`);
                }

                // STEP B: Transactional DB Update
                // This ensures Subscription status and Entitlement revocation are synchronized.
                await prisma.$transaction(async (tx) => {
                    // Update subscription status
                    await tx.userSubscription.update({
                        where: { id: sub.id },
                        data: {
                            status: "cancelled",
                            updatedAt: new Date()
                        }
                    });

                    // Revoke specific entitlement for this target
                    await tx.userEntitlement.updateMany({
                        where: {
                            userId: sub.userId,
                            type: planType,
                            targetId: targetId,
                            status: "active"
                        },
                        data: {
                            status: "revoked",
                            updatedAt: new Date()
                        }
                    });
                });

                console.log(`[PLAN] DB status updated for user: ${sub.userId}`);

            } catch (error: any) {
                // If this fails, we log it for manual intervention
                // But we don't stop the loop for other users
                console.error(`[CRITICAL] Partial failure for sub ${sub.id}: ${error.message}`);
                // NOTE: We could add a "failed_cleanup" record here for an admin dashboard
            }
        }
    }

    console.log(`[PLAN] Cleanup complete for ${planType}: ${targetId}`);
};
