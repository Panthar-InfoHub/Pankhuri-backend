import { Prisma, CourseStatus, CourseLevel, PlanType } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// ==================== HELPERS ====================

/**
 * Optimized helper to attach pricing and ownership to multiple courses
 * PRODUCTION GRADE: Now includes Category-based entitlements and Whole App access.
 */
const attachPricingToCourses = async (courses: any[], userId?: string) => {
  if (courses.length === 0) return courses;

  const courseIds = courses.map((c) => c.id).filter(Boolean);
  const directCategoryIds = [...new Set(courses.map((c) => c.categoryId).filter(Boolean))];

  // 1. Fetch category hierarchy to support recursive access and pricing
  const allCategories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  const getCategoryAndAncestors = (catId: string): string[] => {
    const ancestors: string[] = [];
    let currentId: string | null = catId;
    while (currentId) {
      ancestors.push(currentId);
      const cat = allCategories.find((c) => c.id === currentId);
      currentId = cat?.parentId || null;
    }
    return ancestors;
  };

  // Map each category to its full ancestor chain (including itself)
  const categoryHierarchyMap = new Map<string, string[]>();
  directCategoryIds.forEach((id) => {
    categoryHierarchyMap.set(id as string, getCategoryAndAncestors(id as string));
  });

  // Collect all relevant category IDs (direct + ancestors) for plan fetching
  const allRelevantCategoryIds = [...new Set(Array.from(categoryHierarchyMap.values()).flat())];

  // 2. Fetch all applicable active plans (Course, Category [including ancestors], or Whole App)
  const allPlans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
      OR: [
        { targetId: { in: courseIds as string[] }, planType: PlanType.COURSE },
        { targetId: { in: allRelevantCategoryIds }, planType: PlanType.CATEGORY },
        { planType: PlanType.WHOLE_APP },
      ],
    },
    orderBy: { order: "asc" },
  });

  // 3. Fetch User Context (Role & Entitlements)
  let activeCourseEntitlements: string[] = [];
  let activeCategoryEntitlements: string[] = [];
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
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
        },
      },
    });

    if (user) {
      isAdmin = user.role === "admin";
      const entitlements = user.entitlements;
      hasFullApp = entitlements.some((e) => e.type === "WHOLE_APP");
      activeCourseEntitlements = entitlements
        .filter((e) => e.type === "COURSE")
        .map((e) => e.targetId as string);
      activeCategoryEntitlements = entitlements
        .filter((e) => e.type === "CATEGORY")
        .map((e) => e.targetId as string);
    }
  }

  const wholeAppPlan = allPlans.find((p) => p.planType === "WHOLE_APP");

  // 4. Map everything back to the courses with optimized logic
  return courses.map((course) => {
    const ancestors = categoryHierarchyMap.get(course.categoryId) || [course.categoryId];

    // Find relevant plans, prioritizing specificity (Course > Category > App)
    const coursePlan = allPlans.find(
      (p) => p.planType === PlanType.COURSE && p.targetId === course.id,
    );
    // For category plans, find the nearest one (first in the ancestor chain)
    const categoryPlan = allPlans.find(
      (p) => p.planType === PlanType.CATEGORY && ancestors.includes(p.targetId as string),
    );

    const plan = coursePlan || categoryPlan || wholeAppPlan;

    // Ownership check: Admin BYPASS OR App-wide OR Direct Course OR Any Category in hierarchy (Parent/Indirect)
    const isOwned =
      isAdmin ||
      hasFullApp ||
      activeCourseEntitlements.includes(course.id) ||
      ancestors.some((id) => activeCategoryEntitlements.includes(id));

    return {
      ...course,
      isPaid: !!plan,
      hasAccess: isOwned || !plan,
      pricing: coursePlan || null,
    };
  });
};

/**
 * Helper for single course detail
 */
const attachPricingToCourse = async (course: any, userId?: string) => {
  if (!course) return null;
  const results = await attachPricingToCourses([course], userId);
  return results[0];
};

// ==================== COURSE QUERIES ====================

/**
 * Get all courses with advanced filtering and pagination
 * Optimized for production search and sorting.
 */
export const getAllCourses = async (filters?: {
  categoryId?: string;
  trainerId?: string;
  level?: CourseLevel;
  language?: string;
  status?: CourseStatus;
  search?: string;
  tags?: string[];
  duration?: "short" | "long";
  sort?: "newest" | "popular" | "rating" | "title";
  page?: number;
  limit?: number;
  userId?: string;
}) => {
  const {
    categoryId,
    trainerId,
    level,
    language,
    status = CourseStatus.active, // Default to active for public
    search,
    tags,
    duration,
    sort = "newest",
    page = 1,
    limit = 20,
    userId,
  } = filters || {};

  const where: Prisma.CourseWhereInput = {
    status,
    ...(categoryId && { categoryId }),
    ...(trainerId && { trainerId }),
    ...(level && { level }),
    ...(language && { language }),
    ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
    ...(duration && { duration: duration === "short" ? { lte: 180 } : { gt: 180 } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ],
    }),
  };

  let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "popular" || sort === "rating") orderBy = { rating: "desc" };
  else if (sort === "title") orderBy = { title: "asc" };

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        trainer: {
          select: {
            id: true,
            user: { select: { id: true, displayName: true, profileImage: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  const data = await attachPricingToCourses(courses, userId);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get detailed course data including curriculum
 * Optimized: Single query for curriculum, secure post-processing.
 */
export const getCourseById = async (id: string, userId?: string) => {
  // 1. Fetch course first to check status
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      demoVideo: { select: { id: true, playbackUrl: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { id: true, displayName: true, profileImage: true, email: true } },
        },
      },
      _count: { select: { modules: true, lessons: true } },
    },
  });

  if (!course) return null;

  // 2. Fetch User Context for Admin check
  let isAdmin = false;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    isAdmin = user?.role === "admin";
  }

  // Edge Case: Non-admin trying to view unpublished/archived course
  if (!isAdmin && course.status !== CourseStatus.active) {
    return null; // Or throw custom error
  }

  // 3. Define status filter & Fetch Curriculum (Separate query or include)
  const courseStatusFilter = isAdmin ? {} : { status: CourseStatus.active };
  const lessonStatusFilter = isAdmin ? {} : { status: "published" as any };

  // Fetch full curriculum now that we have the status policy
  const fullCurriculum = await prisma.course.findUnique({
    where: { id: id },
    select: {
      modules: {
        where: isAdmin ? {} : { status: "published" as any }, // Modules use published/draft
        orderBy: { sequence: "asc" },
        include: {
          lessons: {
            where: lessonStatusFilter,
            orderBy: { sequence: "asc" },
            include: {
              videoLesson: {
                include: {
                  video: { select: { id: true, title: true, thumbnailUrl: true, duration: true } },
                },
              },
              textLesson: true,
            },
          },
        },
      },
      lessons: {
        where: { moduleId: null, ...lessonStatusFilter },
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: { select: { id: true, title: true, thumbnailUrl: true, duration: true } },
            },
          },
          textLesson: true,
        },
      },
    },
  });

  const { modules: rawModules, lessons: rawLessons } = fullCurriculum || {
    modules: [],
    lessons: [],
  };
  const courseWithPricing = await attachPricingToCourse(course, userId);
  const hasAccess = courseWithPricing.hasAccess;

  // curriculum logic: Secure items and flatten for unified UI
  const curriculum: any[] = [];

  // 1. Process Modules
  rawModules.forEach((module: any) => {
    curriculum.push({
      ...module,
      itemType: "module",
      type: "module",
      lessons: module.lessons.map((l: any) => {
        const thumbnail = l.videoLesson?.video?.thumbnailUrl || null;
        if (!hasAccess && !l.isFree) {
          // Strip core content for locked lessons but KEEP thumbnail for UI
          const { videoLesson, textLesson, metadata, description, ...safeLesson } = l;
          return { ...safeLesson, thumbnail, isLocked: true };
        }
        return { ...l, thumbnail, isLocked: false };
      }),
    });
  });

  // 2. Process Direct Lessons
  rawLessons.forEach((lesson: any) => {
    const thumbnail = lesson.videoLesson?.video?.thumbnailUrl || null;
    if (!hasAccess && !lesson.isFree) {
      const { videoLesson, textLesson, metadata, description, ...safeLesson } = lesson;
      curriculum.push({ ...safeLesson, itemType: "lesson", thumbnail, isLocked: true });
    } else {
      curriculum.push({ ...lesson, itemType: "lesson", thumbnail, isLocked: false });
    }
  });

  curriculum.sort((a, b) => a.sequence - b.sequence);

  // Stats calculation
  let totalLessons = rawLessons.length;
  let totalDuration = 0;
  rawModules.forEach((m: any) => {
    totalLessons += m.lessons.length;
    m.lessons.forEach((l: any) => {
      totalDuration += l.duration || 0;
    });
  });
  rawLessons.forEach((l: any) => {
    totalDuration += l.duration || 0;
  });

  // 4. Certificate and Progress Info
  let certificateInfo = {
    hasCertificate: course.hasCertificate,
    isClaimable: false,
    isCompleted: false,
    certificateUrl: null as string | null,
  };

  if (userId) {
    const [progress, certificate] = await Promise.all([
      prisma.userCourseProgress.findUnique({
        where: { userId_courseId: { userId, courseId: id } },
        select: { isCompleted: true },
      }),
      prisma.certificate.findFirst({
        where: { userId, courseId: id },
        select: { certificateUrl: true },
      }),
    ]);

    certificateInfo.isCompleted = progress?.isCompleted || false;
    certificateInfo.certificateUrl = certificate?.certificateUrl || null;

    // Claimable if course has cert, user completed it, and user has access
    certificateInfo.isClaimable =
      course.hasCertificate && hasAccess && (progress?.isCompleted || false);
  }

  return {
    ...courseWithPricing,
    curriculum,
    certificateInfo,
    stats: {
      totalModules: rawModules.length,
      totalLessons,
      totalDuration,
    },
  };
};

/**
 * Get detailed course by slug
 */
export const getCourseBySlug = async (slug: string, userId?: string) => {
  // For production, we reuse the ID logic after fetching ID by slug
  // This avoids maintain duality between ID and Slug curriculum logic.
  const courseMeta = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!courseMeta) return null;
  return getCourseById(courseMeta.id, userId);
};

// ==================== RELATED & TRENDING ====================

export const getRelatedCourses = async (courseId: string, limit = 6, userId?: string) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { categoryId: true, level: true, tags: true },
  });
  if (!course) return [];

  const relatedCourses = await prisma.course.findMany({
    where: {
      id: { not: courseId },
      status: "active",
      OR: [
        { categoryId: course.categoryId },
        { level: course.level },
        { tags: { hasSome: course.tags } },
      ],
    },
    include: {
      trainer: {
        select: {
          id: true,
          user: { select: { displayName: true, profileImage: true } },
        },
      },
    },
    take: limit,
    orderBy: { rating: "desc" },
  });

  return await attachPricingToCourses(relatedCourses, userId);
};

export const getTrendingCourses = async (limit = 10, userId?: string) => {
  const courses = await prisma.course.findMany({
    where: { status: "active" },
    include: {
      category: { select: { name: true, slug: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { displayName: true, profileImage: true } },
        },
      },
    },
    orderBy: { rating: "desc" },
    take: limit,
  });
  return await attachPricingToCourses(courses, userId);
};

// ==================== MUTATIONS (ADMIN) ====================

export const createCourse = async (data: Prisma.CourseCreateInput) => {
  try {
    return await prisma.course.create({
      data,
      include: {
        category: true,
        trainer: { select: { id: true, user: { select: { displayName: true, email: true } } } },
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") throw new Error("Course with this slug already exists");
    throw error;
  }
};

export const updateCourse = async (id: string, data: Prisma.CourseUpdateInput) => {
  try {
    return await prisma.course.update({
      where: { id },
      data,
      include: {
        category: true,
        trainer: { select: { id: true, user: { select: { displayName: true } } } },
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") throw new Error("Course title/slug conflict");
    throw error;
  }
};

export const deleteCourse = async (id: string) => {
  await prisma.course.delete({ where: { id } });
  return { message: "Course deleted successfully" };
};

export const togglePublish = async (id: string, status: CourseStatus) => {
  return await prisma.course.update({
    where: { id },
    data: { status },
  });
};

export const getCoursesByTrainer = async (trainerId: string, userId?: string) => {
  const courses = await prisma.course.findMany({
    where: { trainerId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return await attachPricingToCourses(courses, userId);
};
