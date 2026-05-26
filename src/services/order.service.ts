import { prisma } from "@/lib/db";
import { Prisma, PaymentStatus, PaymentType } from "@/prisma/generated/prisma/client";

// ==================== TYPES ====================

interface OrderFilters {
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  paymentType?: PaymentType;
  paymentGateway?: string;
  planType?: "WHOLE_APP" | "CATEGORY" | "COURSE";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest" | "amount_high" | "amount_low";
}

// ==================== ADMIN: GET ALL ORDERS ====================

/**
 * Admin: Get all orders (Payment records) with filtering, search, pagination, and summary.
 * Optimized with parallel queries and proper indexing.
 */
export const getAdminOrders = async (filters: OrderFilters) => {
  const {
    page = 1,
    limit = 20,
    status,
    paymentType,
    paymentGateway,
    planType,
    search,
    dateFrom,
    dateTo,
    sort = "newest",
  } = filters;

  // ==================== BUILD WHERE CLAUSE ====================

  const where: Prisma.PaymentWhereInput = {};

  // Status filter
  if (status) {
    where.status = status;
  }

  // Payment type filter
  if (paymentType) {
    where.paymentType = paymentType;
  }

  // Payment gateway filter
  if (paymentGateway) {
    where.paymentGateway = paymentGateway;
  }

  // Plan type filter (via relation)
  if (planType) {
    where.plan = { planType };
  }

  // Date range filter
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      // Set to end of day for dateTo
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  // Search across user fields, orderId, paymentId
  if (search) {
    where.OR = [
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search } } },
      { orderId: { contains: search, mode: "insensitive" } },
      { paymentId: { contains: search, mode: "insensitive" } },
      { plan: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // ==================== SORT ====================

  let orderBy: Prisma.PaymentOrderByWithRelationInput;
  switch (sort) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "amount_high":
      orderBy = { amount: "desc" };
      break;
    case "amount_low":
      orderBy = { amount: "asc" };
      break;
    case "newest":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  // ==================== PARALLEL QUERIES ====================

  const [orders, total, summaryAgg, statusCounts] = await Promise.all([
    // 1. Main paginated query
    prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            planType: true,
            targetId: true,
            subscriptionType: true,
            price: true,
            discountedPrice: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),

    // 2. Total count (for pagination)
    prisma.payment.count({ where }),

    // 3. Revenue aggregate (sum of paid payments within the filtered scope)
    prisma.payment.aggregate({
      where: { ...where, status: "paid" },
      _sum: { amount: true },
      _count: true,
    }),

    // 4. Status breakdown counts (within the filtered scope, excluding status filter itself)
    prisma.payment.groupBy({
      by: ["status"],
      where: (() => {
        // Remove the status filter for the breakdown so we get counts for all statuses
        const { status: _, ...whereWithoutStatus } = where;
        return whereWithoutStatus;
      })(),
      _count: true,
    }),
  ]);

  // ==================== FORMAT RESPONSE ====================

  const formattedOrders = orders.map((order) => ({
    id: order.id,
    orderId: order.orderId,
    paymentId: order.paymentId,
    invoiceId: order.invoiceId,
    transactionId: order.transactionId,
    amount: order.amount,
    amountInRupees: order.amount / 100,
    currency: order.currency,
    status: order.status,
    paymentType: order.paymentType,
    paymentGateway: order.paymentGateway,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    user: order.user,
    plan: order.plan,
    metadata: order.metadata,
  }));

  // Build status counts map
  const statusCountsMap: Record<string, number> = {};
  statusCounts.forEach((item) => {
    statusCountsMap[item.status] = item._count;
  });

  return {
    data: formattedOrders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalRevenue: summaryAgg._sum.amount || 0,
      totalRevenueInRupees: (summaryAgg._sum.amount || 0) / 100,
      paidOrders: summaryAgg._count || 0,
      totalOrders: total,
      statusBreakdown: {
        paid: statusCountsMap["paid"] || 0,
        pending: statusCountsMap["pending"] || 0,
        failed: statusCountsMap["failed"] || 0,
        refunded: statusCountsMap["refunded"] || 0,
      },
    },
  };
};

// ==================== ADMIN: GET ORDER BY ID ====================
export const getAdminOrderById = async (id: string) => {
  const order = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          profileImage: true,
          createdAt: true,
        }
      },
      plan: true,
      userSubscription: {
        include: {
          payments: {
            take: 5,
            orderBy: { createdAt: "desc" }
          }
        }
      }
    }
  });
  return order;
};
