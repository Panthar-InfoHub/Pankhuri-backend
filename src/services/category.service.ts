import { Prisma, CategoryStatus } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// Helper to attach pricing and ownership to categories (Optimized)
const attachPricingToCategories = async (categories: any[], userId?: string) => {
  if (categories.length === 0) return [];

  // Recursive collection of all IDs in the tree
  const getAllIds = (cats: any[]): string[] => {
    return cats.reduce((acc, cat) => {
      acc.push(cat.id);
      if (cat.children) acc.push(...getAllIds(cat.children));
      return acc;
    }, [] as string[]);
  };

  const allIds = getAllIds(categories);

  // 1. Batch fetch all active plans for these categories
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: {
      targetId: { in: allIds },
      planType: "CATEGORY",
      isActive: true
    }
  });

  // 2. If userId provided, batch fetch active entitlements
  let activeEntitlements: string[] = [];
  let hasFullApp = false;
  if (userId) {
    const entitlements = await prisma.userEntitlement.findMany({
      where: {
        userId,
        status: "active",
        OR: [
          { validUntil: null },
          { validUntil: { gt: new Date() } }
        ]
      }
    });
    hasFullApp = entitlements.some(e => e.type === "WHOLE_APP");
    activeEntitlements = entitlements
      .filter(e => e.type === "CATEGORY" && e.targetId)
      .map(e => e.targetId as string);
  }

  // 3. Recursive mapper
  const mapCategories = (cats: any[]): any[] => {
    return cats.map(cat => {
      const catPlans = allPlans.filter(p => p.targetId === cat.id);
      const isOwned = activeEntitlements.includes(cat.id);

      const categoryWithPricing = {
        ...cat,
        isPaid: catPlans.length > 0,
        hasAccess: hasFullApp || isOwned || catPlans.length === 0,
        pricing: catPlans
      };

      if (cat.children && cat.children.length > 0) {
        categoryWithPricing.children = mapCategories(cat.children);
      }

      return categoryWithPricing;
    });
  };

  return mapCategories(categories);
};

// Help to attach pricing to a single category
const attachPricingToCategory = async (cat: any, userId?: string) => {
  if (!cat) return null;
  const results = await attachPricingToCategories([cat], userId);
  return results[0];
}

// Get all categories (tree structure)
export const getAllCategories = async (status?: CategoryStatus, userId?: string) => {
  const where: Prisma.CategoryWhereInput = status ? { status } : {};

  const categories = await prisma.category.findMany({
    where: {
      ...where,
      parentId: null, // Get root categories only
    },
    include: {
      children: {
        include: {
          children: true, // Support 2 levels deep
        },
      },
      _count: {
        select: {
          courses: true,
        },
      },
    },
    orderBy: {
      sequence: "asc",
    },
  });

  return await attachPricingToCategories(categories, userId);
};

// Get flat list of categories
export const getFlatCategories = async (filters?: {
  status?: CategoryStatus;
  search?: string;
  page?: number;
  limit?: number;
  userId?: string;
}) => {
  const { status, search, page = 1, limit = 50, userId } = filters || {};

  const where: Prisma.CategoryWhereInput = {
    ...(status && { status }),
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
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            courses: true,
            children: true,
          },
        },
      },
      orderBy: {
        sequence: "asc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  const categoriesWithPricing = await attachPricingToCategories(categories, userId);

  return {
    data: categoriesWithPricing,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get category by ID
export const getCategoryById = async (id: string, showNestedCourses: boolean = false, userId?: string) => {
  // Build dynamic include for children based on flag
  const childrenInclude: any = {
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      status: true,
      sequence: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          courses: true,
        },
      },
    },
  };

  // Only fetch child courses if flag is enabled
  if (showNestedCourses) {
    childrenInclude.select.courses = {
      where: {
        status: "active",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailImage: true,
        level: true,
        duration: true,
        rating: true,
      },
    };
  }

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: childrenInclude,
      courses: {
        where: {
          status: "active",
        },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
          level: true,
          duration: true,
          rating: true,
        },
      },
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!category) {
    return null;
  }

  // If showNestedCourses is true, flatten child courses into parent
  if (showNestedCourses && category.children.length > 0) {
    const childCourses = category.children.flatMap((child: any) => child.courses || []);
    category.courses = [...category.courses, ...childCourses];

    // Update count to reflect total courses (parent + children)
    category._count.courses = category.courses.length;

    // Remove courses from children to avoid duplication in frontend
    category.children = category.children.map((child: any) => {
      const { courses, ...childWithoutCourses } = child;
      return childWithoutCourses;
    });
  }

  return await attachPricingToCategory(category, userId);
};

// Get category by slug
export const getCategoryBySlug = async (slug: string, showNestedCourses: boolean = false, userId?: string) => {
  // Build dynamic include for children based on flag
  const childrenInclude: any = {
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      status: true,
      sequence: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          courses: true,
        },
      },
    },
  };

  // Only fetch child courses if flag is enabled
  if (showNestedCourses) {
    childrenInclude.select.courses = {
      where: {
        status: "active",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailImage: true,
        level: true,
        duration: true,
        rating: true,
      },
    };
  }

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: childrenInclude,
      courses: {
        where: {
          status: "active",
        },
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
          level: true,
          duration: true,
          rating: true,
        },
      },
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!category) {
    return null;
  }

  // If showNestedCourses is true, flatten child courses into parent
  if (showNestedCourses && category.children.length > 0) {
    const childCourses = category.children.flatMap((child: any) => child.courses || []);
    category.courses = [...category.courses, ...childCourses];

    // Update count to reflect total courses (parent + children)
    category._count.courses = category.courses.length;

    // Remove courses from children to avoid duplication in frontend
    category.children = category.children.map((child: any) => {
      const { courses, ...childWithoutCourses } = child;
      return childWithoutCourses;
    });
  }

  return await attachPricingToCategory(category, userId);
};

// Get child categories
export const getChildCategories = async (parentId: string) => {
  const children = await prisma.category.findMany({
    where: { parentId },
    include: {
      _count: {
        select: {
          courses: true,
          children: true,
        },
      },
    },
    orderBy: {
      sequence: "asc",
    },
  });

  return children;
};

// Create category (Admin)
export const createCategory = async (data: Prisma.CategoryCreateInput) => {
  // Check if slug already exists
  const existing = await prisma.category.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new Error("Category with this slug already exists");
  }

  const category = await prisma.category.create({
    data,
    include: {
      parent: true,
    },
  });

  return category;
};

// Update category (Admin)
export const updateCategory = async (id: string, data: Prisma.CategoryUpdateInput) => {
  // If slug is being updated, check uniqueness
  if (data.slug && typeof data.slug === "string") {
    const existing = await prisma.category.findFirst({
      where: {
        slug: data.slug,
        NOT: { id },
      },
    });

    if (existing) {
      throw new Error("Category with this slug already exists");
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data,
    include: {
      parent: true,
      children: true,
    },
  });

  return category;
};

// Delete category (Admin)
export const deleteCategory = async (id: string) => {
  // Check if category has children or courses
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          children: true,
          courses: true,
        },
      },
    },
  });

  if (!category) {
    throw new Error("Category not found");
  }

  if (category._count.children > 0) {
    throw new Error("Cannot delete category with child categories");
  }

  if (category._count.courses > 0) {
    throw new Error("Cannot delete category with associated courses");
  }

  await prisma.category.delete({
    where: { id },
  });

  return { message: "Category deleted successfully" };
};

// Update category sequence (Admin)
export const updateSequence = async (id: string, sequence: number) => {
  const category = await prisma.category.update({
    where: { id },
    data: { sequence },
  });

  return category;
};

// Toggle category status (Admin)
export const toggleStatus = async (id: string, status: CategoryStatus) => {
  const category = await prisma.category.update({
    where: { id },
    data: { status },
  });

  return category;
};
