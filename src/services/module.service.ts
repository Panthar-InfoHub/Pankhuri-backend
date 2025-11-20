import { prisma } from "@/lib/db";
import { Module, ModuleStatus, Prisma } from "@/prisma/generated/prisma/client";

// ==================== MODULE CRUD OPERATIONS ====================

/**
 * Get all modules for a course
 */
export const getModulesByCourse = async (
  courseId: string,
  filters?: {
    status?: ModuleStatus;
  }
): Promise<Module[]> => {
  const where: Prisma.ModuleWhereInput = {
    courseId,
    ...(filters?.status && { status: filters.status }),
  };

  return await prisma.module.findMany({
    where,
    include: {
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
        },
      },
      _count: {
        select: {
          lessons: true,
        },
      },
    },
    orderBy: { sequence: "asc" },
  });
};

/**
 * Get module by ID with lessons
 */
export const getModuleById = async (moduleId: string): Promise<Module | null> => {
  return await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
        },
      },
      _count: {
        select: {
          lessons: true,
        },
      },
    },
  });
};

/**
 * Get module by slug within a course
 */
export const getModuleBySlug = async (courseId: string, slug: string): Promise<Module | null> => {
  return await prisma.module.findUnique({
    where: {
      courseId_slug: {
        courseId,
        slug,
      },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
        },
      },
      _count: {
        select: {
          lessons: true,
        },
      },
    },
  });
};

/**
 * Create a new module
 */
export const createModule = async (moduleData: Prisma.ModuleCreateInput): Promise<Module> => {
  return await prisma.module.create({
    data: moduleData,
    include: {
      lessons: true,
      _count: {
        select: {
          lessons: true,
        },
      },
    },
  });
};

/**
 * Update module
 */
export const updateModule = async (
  moduleId: string,
  updates: Prisma.ModuleUpdateInput
): Promise<Module> => {
  return await prisma.module.update({
    where: { id: moduleId },
    data: updates,
    include: {
      lessons: {
        orderBy: { sequence: "asc" },
      },
      _count: {
        select: {
          lessons: true,
        },
      },
    },
  });
};

/**
 * Delete module
 */
export const deleteModule = async (moduleId: string): Promise<void> => {
  // Check if module has lessons
  const module = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      _count: {
        select: {
          lessons: true,
        },
      },
    },
  });

  if (module && module._count.lessons > 0) {
    throw new Error("Cannot delete module with lessons. Please delete or move lessons first.");
  }

  await prisma.module.delete({
    where: { id: moduleId },
  });
};

/**
 * Update module sequence/order
 */
export const updateModuleSequence = async (
  moduleId: string,
  newSequence: number
): Promise<Module> => {
  return await prisma.module.update({
    where: { id: moduleId },
    data: { sequence: newSequence },
  });
};

/**
 * Bulk update module sequences
 */
export const bulkUpdateModuleSequences = async (
  updates: Array<{ id: string; sequence: number }>
): Promise<void> => {
  await prisma.$transaction(
    updates.map((update) =>
      prisma.module.update({
        where: { id: update.id },
        data: { sequence: update.sequence },
      })
    )
  );
};

// ==================== MODULE STATUS MANAGEMENT ====================

/**
 * Publish a module (and optionally all its lessons)
 */
export const publishModule = async (
  moduleId: string,
  publishLessons: boolean = false
): Promise<Module> => {
  if (publishLessons) {
    // Use transaction to publish module and all its lessons
    return await prisma.$transaction(async (tx) => {
      // Publish all lessons in module
      await tx.lesson.updateMany({
        where: { moduleId },
        data: { status: "published" },
      });

      // Publish module
      return await tx.module.update({
        where: { id: moduleId },
        data: {
          status: ModuleStatus.published,
        },
        include: {
          lessons: true,
        },
      });
    });
  }

  return await prisma.module.update({
    where: { id: moduleId },
    data: {
      status: ModuleStatus.published,
    },
  });
};

/**
 * Archive a module
 */
export const archiveModule = async (moduleId: string): Promise<Module> => {
  return await prisma.module.update({
    where: { id: moduleId },
    data: {
      status: ModuleStatus.archived,
    },
  });
};

// ==================== MODULE ANALYTICS ====================

/**
 * Get module count by course
 */
export const getModuleCountByCourse = async (courseId: string): Promise<number> => {
  return await prisma.module.count({
    where: { courseId },
  });
};

/**
 * Calculate total duration of module from its lessons
 */
export const calculateModuleDuration = async (moduleId: string): Promise<number> => {
  const lessons = await prisma.lesson.findMany({
    where: { moduleId },
    select: { duration: true },
  });

  return lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
};

/**
 * Update module duration based on its lessons
 */
export const updateModuleDuration = async (moduleId: string): Promise<Module> => {
  const totalDuration = await calculateModuleDuration(moduleId);

  return await prisma.module.update({
    where: { id: moduleId },
    data: { duration: totalDuration },
  });
};

// ==================== MODULE WITH PROGRESS ====================

/**
 * Get modules with user progress
 * Progress tracking will be implemented separately
 */
export const getModulesWithProgress = async (courseId: string, userId: string): Promise<any[]> => {
  // For now, just return modules without progress
  return await getModulesByCourse(courseId, { status: ModuleStatus.published });
};

// ==================== NAVIGATION HELPERS ====================

/**
 * Get next module
 */
export const getNextModule = async (
  courseId: string,
  currentSequence: number
): Promise<Module | null> => {
  return await prisma.module.findFirst({
    where: {
      courseId,
      sequence: { gt: currentSequence },
      status: ModuleStatus.published,
    },
    orderBy: { sequence: "asc" },
    include: {
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
        },
      },
    },
  });
};

/**
 * Get previous module
 */
export const getPreviousModule = async (
  courseId: string,
  currentSequence: number
): Promise<Module | null> => {
  return await prisma.module.findFirst({
    where: {
      courseId,
      sequence: { lt: currentSequence },
      status: ModuleStatus.published,
    },
    orderBy: { sequence: "desc" },
    include: {
      lessons: {
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
        },
      },
    },
  });
};
