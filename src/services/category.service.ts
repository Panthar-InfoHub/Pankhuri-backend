import { Prisma, CategoryStatus } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// ==================== HELPERS ====================

/**
 * Optimized helper to attach pricing and ownership to categories
 * PRODUCTION GRADE: Supports hierarchical access checks (Parent access grants Child access).
 */
const attachPricingToCategories = async (categories: any[], userId?: string) => {
  if (categories.length === 0) return [];

  // Helper to get all IDs including nested children for batch processing
  const getAllIds = (cats: any[]): string[] => {
    return cats.reduce((acc, cat) => {
      acc.push(cat.id);
      if (cat.children) acc.push(...getAllIds(cat.children));
      return acc;
    }, [] as string[]);
  };

  const allIds = getAllIds(categories);

  // 1. Batch fetch all category-specific plans
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: {
      targetId: { in: allIds },
      planType: "CATEGORY",
      isActive: true
    }
  });

  // 2. Fetch User Context (Role & Entitlements)
  let userEntitlementIds: string[] = [];
  let hasFullApp = false;
  let isAdmin = false;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
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

    if (user) {
      isAdmin = user.role === "admin";
      const entitlements = user.entitlements;
      hasFullApp = entitlements.some(e => e.type === "WHOLE_APP");
      userEntitlementIds = entitlements
        .filter(e => e.type === "CATEGORY")
        .map(e => e.targetId as string);
    }
  }

  // 3. Recursive mapper with hierarchy-aware access
  const mapCategories = (cats: any[], parentHasAccess: boolean = false): any[] => {
    return cats.map(cat => {
      const catPlans = allPlans.filter(p => p.targetId === cat.id);
      const hasDirectEntitlement = userEntitlementIds.includes(cat.id);

      // Access Logic: Admin BYPASS OR App-wide OR Direct OR Inherited from Parent OR Free (no plans)
      const currentCatHasAccess = isAdmin || hasFullApp || hasDirectEntitlement || parentHasAccess || catPlans.length === 0;

      const categoryWithPricing: any = {
        ...cat,
        isPaid: catPlans.length > 0,
        hasAccess: currentCatHasAccess,
        pricing: catPlans
      };

      if (cat.children && cat.children.length > 0) {
        categoryWithPricing.children = mapCategories(cat.children, currentCatHasAccess);
      }

      return categoryWithPricing;
    });
  };

  return mapCategories(categories);
};

const attachPricingToCategory = async (cat: any, userId?: string) => {
  if (!cat) return null;
  const results = await attachPricingToCategories([cat], userId);
  return results[0];
};

// ==================== QUERIES ====================

export const getAllCategories = async (status?: CategoryStatus, userId?: string) => {
  const where: Prisma.CategoryWhereInput = status ? { status } : { status: CategoryStatus.active };

  const categories = await prisma.category.findMany({
    where: { ...where, parentId: null },
    include: {
      children: {
        include: { children: true },
        orderBy: { sequence: "asc" }
      },
      _count: { select: { courses: true } }
    },
    orderBy: { sequence: "asc" },
  });

  return await attachPricingToCategories(categories, userId);
};

export const getFlatCategories = async (filters?: {
  status?: CategoryStatus;
  search?: string;
  page?: number;
  limit?: number;
  userId?: string;
}) => {
  const { status = CategoryStatus.active, search, page = 1, limit = 50, userId } = filters || {};

  const where: Prisma.CategoryWhereInput = {
    status,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { courses: true, children: true } }
      },
      orderBy: { sequence: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  const data = await attachPricingToCategories(categories, userId);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getCategoryById = async (id: string, showNestedCourses: boolean = false, userId?: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: {
        include: { _count: { select: { courses: true } } },
        orderBy: { sequence: "asc" }
      },
      courses: {
        where: { status: "active" },
        select: { id: true, title: true, slug: true, thumbnailImage: true, level: true, duration: true, rating: true },
      },
      _count: { select: { courses: true } },
    },
  });

  if (!category) return null;

  if (showNestedCourses && category.children.length > 0) {
    // In production, we'd fetch these efficiently
    const childIds = category.children.map(c => c.id);
    const childCourses = await prisma.course.findMany({
      where: { categoryId: { in: childIds }, status: "active" },
      select: { id: true, title: true, slug: true, thumbnailImage: true, level: true, duration: true, rating: true }
    });
    category.courses = [...category.courses, ...childCourses];
  }

  return await attachPricingToCategory(category, userId);
};

export const getCategoryBySlug = async (slug: string, showNestedCourses: boolean = false, userId?: string) => {
  const cat = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (!cat) return null;
  return getCategoryById(cat.id, showNestedCourses, userId);
};

// ==================== MUTATIONS (ADMIN) ====================

export const createCategory = async (data: Prisma.CategoryCreateInput) => {
  return await prisma.category.create({
    data,
    include: { parent: true }
  });
};

export const updateCategory = async (id: string, data: Prisma.CategoryUpdateInput) => {
  return await prisma.category.update({
    where: { id },
    data,
    include: { parent: true, children: true }
  });
};

export const deleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, courses: true } } }
  });

  if (!category) throw new Error("Category not found");
  if (category._count.children > 0) throw new Error("Cannot delete category with child categories");
  if (category._count.courses > 0) throw new Error("Cannot delete category with associated courses");

  await prisma.category.delete({ where: { id } });
  return { message: "Category deleted successfully" };
};

export const toggleStatus = async (id: string, status: CategoryStatus) => {
  return await prisma.category.update({
    where: { id },
    data: { status }
  });
};
