import { prisma } from "@/lib/db";
import razorpay from "@/config/razorpay";
import crypto from "crypto";
import { grantEntitlement } from "./entitlement.service";
import { cleanupRedundantSubscriptions } from "./subscription.service";
import { UserEntitlement } from "@/prisma/generated/prisma/client";

/**
 * Purchase Service
 * Handles one-time purchases (e.g. Courses on Web)
 */

/**
 * Initiate a course purchase (Create Razorpay Order)
 */
export const initiateCoursePurchase = async (userId: string, courseId: string) => {
    // 1. Check for Overlapping Access
    const activeEntitlements: UserEntitlement[] = await prisma.userEntitlement.findMany({
        where: {
            userId,
            status: "active",
            OR: [
                { validUntil: null },
                { validUntil: { gt: new Date() } }
            ]
        }
    });

    if (activeEntitlements.some(e => e.type === "WHOLE_APP")) {
        throw new Error("You already have Full App access");
    }

    if (activeEntitlements.some(e => e.type === "COURSE" && e.targetId === courseId)) {
        throw new Error("You already own this course");
    }

    // 2. Verify course exists
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, title: true, metadata: true }
    });

    if (!course) throw new Error("Course not found");

    // 3. Find associated Plan for this course
    const plan = await prisma.subscriptionPlan.findFirst({
        where: {
            planType: "COURSE",
            targetId: courseId,
            isActive: true,
            subscriptionType: "lifetime"
        }
    });

    if (!plan) {
        throw new Error("No active purchase plan found for this course. Access cannot be granted.");
    }

    const price = plan.price;

    // 4. Create Razorpay Order
    const gatewayOrder = await razorpay.orders.create({
        amount: plan.price, // already in paise
        currency: plan.currency,
        notes: {
            userId,
            planId: plan.id,
            subscriptionType: "lifetime",
        },
    });

    // 5. Create/Update User Subscription Record (Pending)
    const subscription = await prisma.userSubscription.upsert({
        where: {
            userId_planId: {
                userId,
                planId: plan?.id || "",
            }
        },
        update: {
            status: "pending",
            updatedAt: new Date()
        },
        create: {
            userId,
            planId: plan?.id,
            status: "pending",
            provider: "razorpay"
        }
    });

    // 6. Store Payment Record
    await prisma.payment.create({
        data: {
            userId,
            planId: plan?.id,
            userSubscriptionId: subscription.id,
            orderId: gatewayOrder.id,
            amount: price,
            currency: "INR",
            paymentType: "one_time",
            status: "pending",
            metadata: {
                courseId,
                courseTitle: course.title
            }
        }
    });

    return {
        orderId: gatewayOrder.id,
        amount: plan.price,
        amountInRupees: plan.price / 100,
        currency: plan.currency,
        keyId: process.env.RAZORPAY_KEY_ID!,
        planName: plan.name,
        subscriptionType: "lifetime",
        userSubscriptionId: subscription.id,
        message: `Direct purchase: ₹${plan.price / 100} for lifetime access`,
    };
};

/**
 * Verify Course Purchase (Webhook or Manual)
 */
export const verifyCoursePurchase = async (
    userId: string,
    orderId: string,
    paymentId: string,
    signature: string
) => {
    // 1. Verify signature to prevent fraud
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(orderId + "|" + paymentId)
        .digest("hex");

    if (expectedSignature !== signature) {
        throw new Error("Invalid payment signature. Fraudulent transaction detected.");
    }

    const payment = await prisma.payment.findFirst({
        where: { orderId, userId },
    });

    if (!payment) throw new Error("Payment record not found");

    const courseId = (payment.metadata as any)?.courseId;

    // 2. Atomic Update: Payment, Subscription, and Entitlement
    const entitlement = await prisma.$transaction(async (tx) => {
        // A. Update Payment
        await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: "paid",
                paymentId,
                updatedAt: new Date()
            }
        });

        // B. Update Subscription
        if (payment.userSubscriptionId) {
            await tx.userSubscription.update({
                where: { id: payment.userSubscriptionId },
                data: {
                    status: "active",
                    updatedAt: new Date()
                }
            });
        }

        // C. Grant Entitlement
        return await grantEntitlement(userId, "COURSE", courseId, { source: "WEB" });
    });

    // 3. Post-transaction Cleanup (Safe to run outside as it's non-critical)
    await cleanupRedundantSubscriptions(userId, "COURSE", courseId);

    return entitlement;
};
