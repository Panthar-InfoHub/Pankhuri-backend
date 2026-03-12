import { Request, Response, NextFunction } from "express";
import * as orderService from "@/services/order.service";
import { PaymentStatus, PaymentType } from "@/prisma/generated/prisma/client";

// Valid enum values for validation
const VALID_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
const VALID_PAYMENT_TYPES: PaymentType[] = ["trial", "recurring", "one_time"];
const VALID_GATEWAYS = ["razorpay", "google_play", "manual"];
const VALID_PLAN_TYPES = ["WHOLE_APP", "CATEGORY", "COURSE"];
const VALID_SORTS = ["newest", "oldest", "amount_high", "amount_low"];

/**
 * GET /api/admin/orders
 * Admin: Get all orders with filtering, search, pagination, and summary
 */
export const getAdminOrdersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page,
      limit,
      status,
      paymentType,
      paymentGateway,
      planType,
      search,
      dateFrom,
      dateTo,
      sort,
    } = req.query;

    // ==================== VALIDATION ====================

    if (status && !VALID_STATUSES.includes(status as PaymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    if (paymentType && !VALID_PAYMENT_TYPES.includes(paymentType as PaymentType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentType. Must be one of: ${VALID_PAYMENT_TYPES.join(", ")}`,
      });
    }

    if (paymentGateway && !VALID_GATEWAYS.includes(paymentGateway as string)) {
      return res.status(400).json({
        success: false,
        message: `Invalid paymentGateway. Must be one of: ${VALID_GATEWAYS.join(", ")}`,
      });
    }

    if (planType && !VALID_PLAN_TYPES.includes(planType as string)) {
      return res.status(400).json({
        success: false,
        message: `Invalid planType. Must be one of: ${VALID_PLAN_TYPES.join(", ")}`,
      });
    }

    if (sort && !VALID_SORTS.includes(sort as string)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort. Must be one of: ${VALID_SORTS.join(", ")}`,
      });
    }

    // Validate date format if provided
    if (dateFrom && isNaN(Date.parse(dateFrom as string))) {
      return res.status(400).json({
        success: false,
        message: "Invalid dateFrom format. Use YYYY-MM-DD",
      });
    }

    if (dateTo && isNaN(Date.parse(dateTo as string))) {
      return res.status(400).json({
        success: false,
        message: "Invalid dateTo format. Use YYYY-MM-DD",
      });
    }

    // ==================== QUERY ====================

    const result = await orderService.getAdminOrders({
      page: Math.max(1, parseInt(page as string) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit as string) || 20)),
      status: status as PaymentStatus | undefined,
      paymentType: paymentType as PaymentType | undefined,
      paymentGateway: paymentGateway as string | undefined,
      planType: planType as "WHOLE_APP" | "CATEGORY" | "COURSE" | undefined,
      search: search as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      sort: sort as "newest" | "oldest" | "amount_high" | "amount_low" | undefined,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
