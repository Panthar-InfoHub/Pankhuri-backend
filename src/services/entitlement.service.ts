import { prisma } from "@/lib/db";
import { PlanType, EntitlementStatus } from "@/prisma/generated/prisma/client";

/**
 * Entitlement Service
 * Manages user access to Courses, Categories, and the Whole App.
 * Design for high performance and production scale.
 */

interface GrantOptions {
    source?: string;
    validUntil?: Date;
}

/**
 * Grant access to a resource
 * Implements "No overlapping" logic: if user has WHOLE_APP, individual course/category access is redundant but stored.
 */
export const grantEntitlement = async (
    userId: string,
    type: PlanType,
    targetId: string | null = null,
    options: GrantOptions = {}
) => {
    // 0. Validate Target ID based on type
    if (type === "COURSE" && targetId) {
        const course = await prisma.course.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!course) throw new Error(`Course with ID ${targetId} not found`);
    } else if (type === "CATEGORY" && targetId) {
        const category = await prisma.category.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!category) throw new Error(`Category with ID ${targetId} not found`);
    }

    // 1. Create or Update Entitlement
    const entitlement = await prisma.userEntitlement.upsert({
        where: {
            userId_type_targetId: {
                userId,
                type,
                targetId: targetId || "",
            },
        },
        update: {
            status: "active",
            source: options.source,
            validUntil: options.validUntil,
            updatedAt: new Date(),
        },
        create: {
            userId,
            type,
            targetId: targetId || "",
            status: "active",
            source: options.source,
            validUntil: options.validUntil,
        },
    });

    return entitlement;
};

/**
 * Revoke access to a resource
 */
export const revokeEntitlement = async (
    userId: string,
    type: PlanType,
    targetId: string | null = null
) => {
    return await prisma.userEntitlement.update({
        where: {
            userId_type_targetId: {
                userId,
                type,
                targetId: targetId || "",
            },
        },
        data: {
            status: "revoked",
            updatedAt: new Date(),
        },
    });
};

/**
 * Efficient check if user has access to a specific resource
 * Logic:
 * - If user has active WHOLE_APP -> Access Granted
 * - If user has active CATEGORY matching course's category -> Access Granted
 * - If user has active COURSE matching targetId -> Access Granted
 */
export const hasAccess = async (
    userId: string | undefined,
    resourceType: "COURSE" | "CATEGORY" | "APP",
    resourceId?: string
): Promise<boolean> => {
    // 0. Check if the resource is natively FREE
    if (resourceType === "COURSE" && resourceId) {
        const plans = await prisma.subscriptionPlan.count({
            where: { targetId: resourceId, planType: "COURSE", isActive: true }
        });
        if (plans === 0) return true; // It's a free course
    } else if (resourceType === "CATEGORY" && resourceId) {
        const plans = await prisma.subscriptionPlan.count({
            where: { targetId: resourceId, planType: "CATEGORY", isActive: true }
        });
        if (plans === 0) return true; // It's a free category
    }

    if (!userId) return false;

    // 1. Fetch user to check globally for ADMIN role or active entitlements
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            entitlements: {
                where: {
                    status: "active",
                    OR: [
                        { validUntil: null },
                        { validUntil: { gt: new Date() } }
                    ]
                }
            }
        }
    });

    if (!user) return false;

    // Global Bypass: Admins have access to everything
    if (user.role === "admin") return true;

    const activeEntitlements = user.entitlements;

    if (activeEntitlements.length === 0) return false;

    // Check for WHOLE_APP access first (Global bypass)
    if (activeEntitlements.some(e => e.type === "WHOLE_APP")) return true;

    if (resourceType === "COURSE" && resourceId) {
        // Check for direct COURSE access
        if (activeEntitlements.some(e => e.type === "COURSE" && e.targetId === resourceId)) return true;

        // Check for CATEGORY access that contains this course
        const course = await prisma.course.findUnique({
            where: { id: resourceId },
            select: { categoryId: true }
        });

        if (course && activeEntitlements.some(e => e.type === "CATEGORY" && e.targetId === course.categoryId)) {
            return true;
        }
    }

    if (resourceType === "CATEGORY" && resourceId) {
        // Check for direct CATEGORY access
        if (activeEntitlements.some(e => e.type === "CATEGORY" && e.targetId === resourceId)) return true;
    }

    return false;
};

/**
 * Get all active entitlements for a user
 */
export const getUserActiveEntitlements = async (userId: string) => {
    return await prisma.userEntitlement.findMany({
        where: {
            userId,
            status: "active",
            OR: [
                { validUntil: null },
                { validUntil: { gt: new Date() } }
            ]
        },
    });
};

/**
 * Sync complex subscription (Category, Whole App) to Entitlement
 */
export const syncSubscriptionToEntitlement = async (subscriptionId: string) => {
    const sub = await prisma.userSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true }
    });

    if (!sub || !sub.plan || (sub.status !== "active" && sub.status !== "trial")) return;

    await grantEntitlement(
        sub.userId,
        sub.plan.planType,
        sub.plan.targetId,
        {
            source: sub.provider === 'google_play' ? 'APP' : 'WEB',
            validUntil: sub.currentPeriodEnd || undefined
        }
    );
};

/**
 * Get all entitlements for Admin (with pagination)
 */
export const getAllEntitlements = async (page: number = 1, limit: number = 50) => {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
        prisma.userEntitlement.count(),
        prisma.userEntitlement.findMany({
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })
    ]);

    return { total, page, limit, items };
};

/**
 * Get entitlements for a specific target (e.g. all users who bought Course X)
 */
export const getEntitlementsByTarget = async (type: PlanType, targetId: string) => {
    return await prisma.userEntitlement.findMany({
        where: { type, targetId, status: "active" },
        include: {
            user: {
                select: {
                    id: true,
                    displayName: true,
                    email: true
                }
            }
        }
    });
};
