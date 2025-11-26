import { prisma } from "@/lib/db";
import {
  UserLessonProgress,
  UserCourseProgress,
  LessonStatus,
} from "@/prisma/generated/prisma/client";

// ==================== LESSON PROGRESS ====================

/**
 * Mark a lesson as completed (or update progress)
 * This is the main entry point for lesson completion
 */
export const markLessonComplete = async (
  userId: string,
  lessonId: string,
  currentTimestamp?: number
): Promise<UserLessonProgress> => {
  // Verify lesson exists and get course info
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true },
  });

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  // Upsert lesson progress
  const lessonProgress = await prisma.userLessonProgress.upsert({
    where: {
      userId_lessonId: { userId, lessonId },
    },
    create: {
      userId,
      lessonId,
      isCompleted: true,
      completedAt: new Date(),
      currentTimestamp: currentTimestamp || 0,
    },
    update: {
      isCompleted: true,
      completedAt: new Date(),
      ...(currentTimestamp !== undefined && { currentTimestamp }),
    },
  });

  // Recalculate course progress
  await recalculateCourseProgress(userId, lesson.courseId);

  return lessonProgress;
};

/**
 * Update lesson timestamp (watching progress)
 */
export const updateLessonTimestamp = async (
  userId: string,
  lessonId: string,
  currentTimestamp: number
): Promise<UserLessonProgress> => {
  return await prisma.userLessonProgress.upsert({
    where: {
      userId_lessonId: { userId, lessonId },
    },
    create: {
      userId,
      lessonId,
      isCompleted: false,
      currentTimestamp,
    },
    update: {
      currentTimestamp,
    },
  });
};

/**
 * Get user's lesson progress
 */
export const getUserLessonProgress = async (
  userId: string,
  lessonId: string
): Promise<UserLessonProgress | null> => {
  return await prisma.userLessonProgress.findUnique({
    where: {
      userId_lessonId: { userId, lessonId },
    },
  });
};

/**
 * Get all lesson progress for a user in a course
 */
export const getUserCourseLessonProgress = async (
  userId: string,
  courseId: string
): Promise<UserLessonProgress[]> => {
  return await prisma.userLessonProgress.findMany({
    where: {
      userId,
      lesson: {
        courseId,
      },
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          slug: true,
          sequence: true,
          moduleId: true,
        },
      },
    },
    orderBy: {
      lesson: {
        sequence: "asc",
      },
    },
  });
};

// ==================== COURSE PROGRESS ====================

/**
 * Core function to recalculate course progress for a user
 * This is called whenever:
 * - A lesson is completed
 * - A lesson is added to the course
 * - A lesson is deleted from the course
 */
export const recalculateCourseProgress = async (
  userId: string,
  courseId: string
): Promise<UserCourseProgress> => {
  // Get all lessons for this course (including those in modules)
  const allLessons = await prisma.lesson.findMany({
    where: {
      courseId,
      status: LessonStatus.published, // Only count published lessons
    },
    select: {
      id: true,
    },
  });

  const totalLessons = allLessons.length;

  if (totalLessons === 0) {
    // No lessons in course - set progress to 0
    return await prisma.userCourseProgress.upsert({
      where: {
        userId_courseId: { userId, courseId },
      },
      create: {
        userId,
        courseId,
        progress: 0,
        isCompleted: false,
      },
      update: {
        progress: 0,
        isCompleted: false,
        completedAt: null,
        lastLessonId: null,
      },
    });
  }

  // Get completed lessons for this user in this course
  const completedLessons = await prisma.userLessonProgress.findMany({
    where: {
      userId,
      isCompleted: true,
      lessonId: {
        in: allLessons.map((l) => l.id),
      },
    },
    select: {
      lessonId: true,
      completedAt: true,
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  const completedCount = completedLessons.length;
  const progress = (completedCount / totalLessons) * 100;
  const isCompleted = progress === 100;
  const lastLessonId = completedLessons.length > 0 ? completedLessons[0].lessonId : null;

  // Check if course was previously completed (to preserve original completedAt)
  const existing = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { completedAt: true, isCompleted: true },
  });

  // Determine completedAt value
  let completedAt: Date | null = null;
  if (isCompleted) {
    // If newly completed, set to now. If was already completed, keep original
    completedAt = existing?.isCompleted && existing.completedAt ? existing.completedAt : new Date();
  }

  // Upsert course progress
  return await prisma.userCourseProgress.upsert({
    where: {
      userId_courseId: { userId, courseId },
    },
    create: {
      userId,
      courseId,
      progress,
      isCompleted,
      completedAt,
      lastLessonId,
    },
    update: {
      progress,
      isCompleted,
      completedAt,
      lastLessonId,
    },
  });
};

/**
 * Recalculate progress for ALL users in a course
 * Called when admin adds/deletes a lesson
 */
export const recalculateAllUsersProgress = async (courseId: string): Promise<void> => {
  // Get all users who have any progress in this course
  const usersWithProgress = await prisma.userCourseProgress.findMany({
    where: { courseId },
    select: { userId: true },
  });

  // Also get users who have completed any lesson in this course but might not have course progress yet
  const usersWithLessonProgress = await prisma.userLessonProgress.findMany({
    where: {
      lesson: {
        courseId,
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  // Combine and deduplicate users
  const allUserIds = new Set([
    ...usersWithProgress.map((u) => u.userId),
    ...usersWithLessonProgress.map((u) => u.userId),
  ]);

  // Recalculate progress for each user
  await Promise.all(
    Array.from(allUserIds).map((userId) => recalculateCourseProgress(userId, courseId))
  );
};

/**
 * Get user's course progress
 */
export const getUserCourseProgress = async (
  userId: string,
  courseId: string
): Promise<UserCourseProgress | null> => {
  return await prisma.userCourseProgress.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
        },
      },
    },
  });
};

/**
 * Get all course progress for a user
 */
export const getUserAllCourseProgress = async (userId: string): Promise<UserCourseProgress[]> => {
  return await prisma.userCourseProgress.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
          categoryId: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

/**
 * Get detailed progress for a course (includes lesson breakdown)
 */
export const getCourseProgressWithDetails = async (
  userId: string,
  courseId: string
): Promise<{
  courseProgress: UserCourseProgress | null;
  totalLessons: number;
  completedLessons: number;
  lessonProgress: UserLessonProgress[];
}> => {
  // Get course progress
  const courseProgress = await getUserCourseProgress(userId, courseId);

  // Get all lessons in course
  const allLessons = await prisma.lesson.findMany({
    where: {
      courseId,
      status: LessonStatus.published,
    },
    select: { id: true },
  });

  // Get lesson progress
  const lessonProgress = await getUserCourseLessonProgress(userId, courseId);

  const completedLessons = lessonProgress.filter((lp) => lp.isCompleted).length;

  return {
    courseProgress,
    totalLessons: allLessons.length,
    completedLessons,
    lessonProgress,
  };
};

// ==================== ADMIN HOOKS ====================

/**
 * Hook to call when a lesson is added
 * Recalculates progress for all users
 */
export const onLessonAdded = async (courseId: string): Promise<void> => {
  await recalculateAllUsersProgress(courseId);
};

/**
 * Hook to call when a lesson is deleted
 * Removes lesson progress entries and recalculates course progress
 */
export const onLessonDeleted = async (lessonId: string, courseId: string): Promise<void> => {
  // Delete all UserLessonProgress entries for this lesson
  await prisma.userLessonProgress.deleteMany({
    where: { lessonId },
  });

  // Recalculate progress for all users
  await recalculateAllUsersProgress(courseId);
};

/**
 * Hook to call when a lesson is moved between modules
 * Progress should remain unchanged, but we verify consistency
 */
export const onLessonMoved = async (lessonId: string, courseId: string): Promise<void> => {
  // Moving lessons doesn't affect progress calculation
  // But we can verify that the lesson still belongs to the same course
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true },
  });

  if (lesson && lesson.courseId !== courseId) {
    // If lesson was moved to a different course, we need to recalculate both courses
    await recalculateAllUsersProgress(courseId);
    await recalculateAllUsersProgress(lesson.courseId);
  }
};

/**
 * Hook to call when lesson status changes (e.g., published to draft)
 * Only published lessons count toward progress
 */
export const onLessonStatusChanged = async (lessonId: string, courseId: string): Promise<void> => {
  await recalculateAllUsersProgress(courseId);
};

// ==================== BULK OPERATIONS ====================

/**
 * Reset user progress for a course (admin function)
 */
export const resetUserCourseProgress = async (userId: string, courseId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    // Delete all lesson progress for lessons in this course
    await tx.userLessonProgress.deleteMany({
      where: {
        userId,
        lesson: {
          courseId,
        },
      },
    });

    // Delete course progress
    await tx.userCourseProgress.delete({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
  });
};

/**
 * Get completed courses for a user
 */
export const getUserCompletedCourses = async (userId: string): Promise<UserCourseProgress[]> => {
  return await prisma.userCourseProgress.findMany({
    where: {
      userId,
      isCompleted: true,
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
          hasCertificate: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  });
};

/**
 * Get in-progress courses for a user
 */
export const getUserInProgressCourses = async (userId: string): Promise<UserCourseProgress[]> => {
  return await prisma.userCourseProgress.findMany({
    where: {
      userId,
      isCompleted: false,
      progress: {
        gt: 0,
      },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailImage: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

// ==================== ANALYTICS ====================

/**
 * Get progress statistics for a course (admin)
 */
export const getCourseProgressStats = async (
  courseId: string
): Promise<{
  totalEnrolled: number;
  completed: number;
  inProgress: number;
  averageProgress: number;
}> => {
  const allProgress = await prisma.userCourseProgress.findMany({
    where: { courseId },
    select: {
      progress: true,
      isCompleted: true,
    },
  });

  const totalEnrolled = allProgress.length;
  const completed = allProgress.filter((p) => p.isCompleted).length;
  const inProgress = allProgress.filter((p) => !p.isCompleted && p.progress > 0).length;
  const averageProgress =
    totalEnrolled > 0 ? allProgress.reduce((sum, p) => sum + p.progress, 0) / totalEnrolled : 0;

  return {
    totalEnrolled,
    completed,
    inProgress,
    averageProgress,
  };
};

/**
 * Get user progress summary (overview)
 */
export const getUserProgressSummary = async (
  userId: string
): Promise<{
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalLessonsCompleted: number;
}> => {
  const courseProgress = await prisma.userCourseProgress.findMany({
    where: { userId },
  });

  const lessonProgress = await prisma.userLessonProgress.findMany({
    where: { userId, isCompleted: true },
  });

  return {
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter((p) => p.isCompleted).length,
    inProgressCourses: courseProgress.filter((p) => !p.isCompleted && p.progress > 0).length,
    totalLessonsCompleted: lessonProgress.length,
  };
};
