import { prisma } from "@/lib/db";

// ==================== PUBLIC ====================

/**
 * Get all active global FAQs (for landing page)
 * These are FAQs where courseId is null
 */
export const getGlobalFaqs = async () => {
  return await prisma.faq.findMany({
    where: { courseId: null, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
    },
  });
};

/**
 * Get course FAQs with access gating (used inside getCourseById)
 * - First 3 are always free
 * - Rest are locked unless user has access
 */
export const getCourseFaqData = async (courseId: string, hasAccess: boolean) => {
  const FREE_FAQ_COUNT = 3;

  const allFaqs = await prisma.faq.findMany({
    where: { courseId, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      question: true,
      answer: true,
      order: true,
    },
  });

  // If 3 or fewer FAQs, or user has access → show all, not locked
  if (allFaqs.length <= FREE_FAQ_COUNT || hasAccess) {
    return {
      faqs: allFaqs,
      totalCount: allFaqs.length,
      freeCount: FREE_FAQ_COUNT,
      isLocked: false,
    };
  }

  // Otherwise, show first 3 free, flag rest as locked
  return {
    faqs: allFaqs.slice(0, FREE_FAQ_COUNT),
    totalCount: allFaqs.length,
    freeCount: FREE_FAQ_COUNT,
    isLocked: true,
  };
};

// ==================== ADMIN: READ ====================

/**
 * Admin: Get FAQs by type (global or course)
 * Returns all FAQs including inactive ones for admin management
 */
export const getAdminFaqs = async (type: "global" | "course", courseId?: string) => {
  if (type === "course" && !courseId) {
    throw new Error("courseId is required when type is 'course'");
  }

  const where = type === "global" ? { courseId: null } : { courseId };

  return await prisma.faq.findMany({
    where,
    orderBy: { order: "asc" },
    include: {
      course: type === "course" ? { select: { id: true, title: true, slug: true } } : false,
    },
  });
};

// ==================== ADMIN: CREATE ====================

/**
 * Admin: Create a global FAQ
 * Throws error if courseId is provided
 */
export const createGlobalFaq = async (data: {
  question: string;
  answer: string;
  order?: number;
  isActive?: boolean;
}) => {
  // Auto-assign order if not provided (append at end)
  let order = data.order;
  if (order === undefined) {
    const lastFaq = await prisma.faq.findFirst({
      where: { courseId: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (lastFaq?.order ?? -1) + 1;
  }

  return await prisma.faq.create({
    data: {
      question: data.question,
      answer: data.answer,
      order,
      isActive: data.isActive ?? true,
      courseId: null,
    },
  });
};

/**
 * Admin: Create a course FAQ
 * Throws error if courseId is not provided or course doesn't exist
 */
export const createCourseFaq = async (data: {
  courseId: string;
  question: string;
  answer: string;
  order?: number;
  isActive?: boolean;
}) => {
  // Validate course exists
  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    select: { id: true },
  });

  if (!course) {
    throw new Error(`Course with ID '${data.courseId}' not found`);
  }

  // Auto-assign order if not provided (append at end)
  let order = data.order;
  if (order === undefined) {
    const lastFaq = await prisma.faq.findFirst({
      where: { courseId: data.courseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (lastFaq?.order ?? -1) + 1;
  }

  return await prisma.faq.create({
    data: {
      question: data.question,
      answer: data.answer,
      order,
      isActive: data.isActive ?? true,
      courseId: data.courseId,
    },
  });
};

// ==================== ADMIN: UPDATE ====================

/**
 * Admin: Update a global FAQ
 * Throws error if the FAQ belongs to a course
 */
export const updateGlobalFaq = async (
  id: string,
  data: { question?: string; answer?: string; order?: number; isActive?: boolean }
) => {
  const faq = await prisma.faq.findUnique({ where: { id } });

  if (!faq) {
    throw new Error(`FAQ with ID '${id}' not found`);
  }

  if (faq.courseId !== null) {
    throw new Error("This FAQ belongs to a course. Use the course FAQ update endpoint instead.");
  }

  return await prisma.faq.update({
    where: { id },
    data: {
      ...(data.question !== undefined && { question: data.question }),
      ...(data.answer !== undefined && { answer: data.answer }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
};

/**
 * Admin: Update a course FAQ
 * Throws error if the FAQ is a global FAQ
 */
export const updateCourseFaq = async (
  id: string,
  data: { question?: string; answer?: string; order?: number; isActive?: boolean }
) => {
  const faq = await prisma.faq.findUnique({ where: { id } });

  if (!faq) {
    throw new Error(`FAQ with ID '${id}' not found`);
  }

  if (faq.courseId === null) {
    throw new Error("This is a global FAQ. Use the global FAQ update endpoint instead.");
  }

  return await prisma.faq.update({
    where: { id },
    data: {
      ...(data.question !== undefined && { question: data.question }),
      ...(data.answer !== undefined && { answer: data.answer }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
};

// ==================== ADMIN: DELETE ====================

/**
 * Admin: Delete a FAQ (works for both global and course)
 */
export const deleteFaq = async (id: string) => {
  const faq = await prisma.faq.findUnique({ where: { id } });

  if (!faq) {
    throw new Error(`FAQ with ID '${id}' not found`);
  }

  await prisma.faq.delete({ where: { id } });
  return { message: "FAQ deleted successfully", id };
};

// ==================== ADMIN: REORDER ====================

/**
 * Admin: Reorder FAQs (batch update order field)
 * Accepts array of { id, order }
 */
export const reorderFaqs = async (items: { id: string; order: number }[]) => {
  if (!items || items.length === 0) {
    throw new Error("Items array is required for reordering");
  }

  const updates = items.map((item) =>
    prisma.faq.update({
      where: { id: item.id },
      data: { order: item.order },
    })
  );

  await prisma.$transaction(updates);
  return { message: "FAQs reordered successfully", count: items.length };
};
