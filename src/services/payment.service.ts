/**
 * Payment Service
 * Handles payment operations and verification
 */

import { prisma } from "@/lib/db";
import { Payment, PaymentStatus, Prisma } from "@/prisma/generated/prisma/client";

// ==================== CREATE PAYMENT ====================

/**
 * Create payment record
 */
export const createPayment = async (
    paymentData: Prisma.PaymentCreateInput
): Promise<Payment> => {
    return await prisma.payment.create({
        data: paymentData,
    });
};

// ==================== GET PAYMENTS ====================

/**
 * Get payment by ID
 */
export const getPaymentById = async (id: string): Promise<Payment> => {
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                },
            },
            plan: true,
        },
    });

    if (!payment) {
        throw new Error("Payment not found");
    }

    return payment;
};

/**
 * Get payment by order ID
 */
export const getPaymentByOrderId = async (orderId: string): Promise<Payment | null> => {
    return await prisma.payment.findFirst({
        where: { orderId },
        include: {
            user: true,
            plan: true,
        },
    });
};

/**
 * Get payment by invoice ID
 */
export const getPaymentByInvoiceId = async (
    invoiceId: string
): Promise<Payment | null> => {
    return await prisma.payment.findFirst({
        where: { invoiceId },
        include: {
            user: true,
            plan: true,
        },
    });
};

/**
 * Get user payments
 */
export const getUserPayments = async (userId: string): Promise<Payment[]> => {
    return await prisma.payment.findMany({
        where: { userId },
        include: {
            plan: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

// ==================== UPDATE PAYMENT ====================

/**
 * Update payment status
 */
export const updatePaymentStatus = async (
    id: string,
    status: PaymentStatus,
    additionalData?: {
        paymentId?: string;
        paymentMethod?: string;
        metadata?: any;
    }
): Promise<Payment> => {
    return await prisma.payment.update({
        where: { id },
        data: {
            status,
            paymentId: additionalData?.paymentId,
            paymentMethod: additionalData?.paymentMethod,
            metadata: additionalData?.metadata,
        },
    });
};


// ==================== RECONCILIATION ====================

/**
 * Reconcile payments with gateway
 * Background job to sync payment status
 */
export const reconcilePayments = async (): Promise<number> => {
    // Get all pending payments older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingPayments = await prisma.payment.findMany({
        where: {
            status: "pending",
            createdAt: {
                lte: oneHourAgo,
            },
        },
    });

    let reconciledCount = 0;

    for (const payment of pendingPayments) {
        try {
            // TODO: Query gateway API to check payment status
            // For now, just log
            console.log(`Reconciling payment ${payment.id}`);
            reconciledCount++;
        } catch (error) {
            console.error(`Failed to reconcile payment ${payment.id}:`, error);
        }
    }

    return reconciledCount;
};

/**
 * Cleanup abandoned orders
 * Background job to mark old pending orders as abandoned
 */
export const cleanupAbandonedOrders = async (): Promise<number> => {
    // Mark orders older than 24 hours as failed
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.payment.updateMany({
        where: {
            status: "pending",
            paymentType: "trial",
            orderId: {
                not: null,
            },
            createdAt: {
                lte: twentyFourHoursAgo,
            },
        },
        data: {
            status: "failed",
            metadata: {
                abandonedAt: new Date(),
                reason: "Order abandoned - no payment received within 24 hours",
            },
        },
    });

    return result.count;
};

// ==================== PAYMENT ANALYTICS ====================

/**
 * Get payment statistics
 */
export const getPaymentStats = async (filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: PaymentStatus;
}): Promise<{
    totalPayments: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
}> => {
    const where: Prisma.PaymentWhereInput = {
        ...(filters?.startDate && {
            createdAt: {
                gte: filters.startDate,
            },
        }),
        ...(filters?.endDate && {
            createdAt: {
                lte: filters.endDate,
            },
        }),
        ...(filters?.status && {
            status: filters.status,
        }),
    };

    const [totalPayments, successfulPayments, failedPayments, payments] =
        await Promise.all([
            prisma.payment.count({ where }),
            prisma.payment.count({ where: { ...where, status: "paid" } }),
            prisma.payment.count({ where: { ...where, status: "failed" } }),
            prisma.payment.findMany({
                where: { ...where, status: "paid" },
                select: { amount: true },
            }),
        ]);

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
        totalPayments,
        totalAmount,
        successfulPayments,
        failedPayments,
    };
};
