import { prisma } from "@/lib/db";
import { Lesson, LessonType, LessonStatus, Prisma } from "@/prisma/generated/prisma/client";
import { onLessonAdded, onLessonDeleted, onLessonStatusChanged } from "./progress.service";
import { hasActiveSubscription } from "./subscription.service";

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user can access a specific lesson
 * Returns lesson with access info, or throws error if no access
 */
export const checkLessonAccess = async (
  lessonId: string,
  userId?: string
): Promise<{ lesson: Lesson; hasAccess: boolean; reason?: string }> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
  });

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  // Free lessons are accessible to everyone
  if (lesson.isFree) {
    return { lesson, hasAccess: true };
  }

  // For paid lessons, check subscription
  if (!userId) {
    return {
      lesson,
      hasAccess: false,
      reason: "This lesson requires an active subscription",
    };
  }

  const { hasAccess: checkEntitlement } = await import("./entitlement.service");
  const hasAccess = await checkEntitlement(userId, "COURSE", lesson.courseId);

  if (!hasAccess) {
    return {
      lesson,
      hasAccess: false,
      reason: "This lesson requires an active subscription or purchase of this course.",
    };
  }

  return { lesson, hasAccess: true };
};

// ==================== LESSON CRUD OPERATIONS ====================

/**
 * Get all lessons for a course with optional filters
 * Returns sanitized data - no sensitive video URLs or content
 */
export const getLessonsByCourse = async (
  courseId: string,
  filters?: {
    moduleId?: string;
    type?: LessonType;
    status?: LessonStatus;
    isFree?: boolean;
  }
): Promise<any[]> => {
  const where: Prisma.LessonWhereInput = {
    courseId,
    ...(filters?.moduleId !== undefined && { moduleId: filters.moduleId }),
    ...(filters?.type && { type: filters.type }),
    ...(filters?.status && { status: filters.status }),
    ...(filters?.isFree !== undefined && { isFree: filters.isFree }),
  };

  // Only fetch safe metadata - no sensitive URLs or content
  const lessons = await prisma.lesson.findMany({
    where,
    select: {
      id: true,
      courseId: true,
      moduleId: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      sequence: true,
      duration: true,
      isFree: true,
      isMandatory: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      // Video metadata only - no playback URLs
      videoLesson: {
        select: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              duration: true,
              status: true,
              // NO: playbackUrl, streamUrl, hlsUrl, dashUrl, downloadUrl
            },
          },
        },
      },
      // Text lesson ID only - no content
      textLesson: {
        select: {
          id: true,
          // NO: content, htmlContent
        },
      },
    },
    orderBy: { sequence: "asc" },
  });

  // Data is already sanitized at query level
  return lessons;
};

/**
 * Get lessons by module
 * Returns sanitized data - no sensitive video URLs or content
 */
export const getLessonsByModule = async (moduleId: string): Promise<any[]> => {
  // Only fetch safe metadata - no sensitive URLs or content
  const lessons = await prisma.lesson.findMany({
    where: { moduleId },
    select: {
      id: true,
      courseId: true,
      moduleId: true,
      title: true,
      slug: true,
      type: true,
      description: true,
      sequence: true,
      duration: true,
      isFree: true,
      isMandatory: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      // Video metadata only - no playback URLs
      videoLesson: {
        select: {
          video: {
            select: {
              id: true,
              title: true,
              thumbnailUrl: true,
              duration: true,
              status: true,
            },
          },
        },
      },
      // Text lesson ID only - no content
      textLesson: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { sequence: "asc" },
  });

  // Data is already sanitized at query level
  return lessons;
};

/**
 * Get lesson by ID
 */
export const getLessonById = async (lessonId: string): Promise<Lesson | null> => {
  return await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
  });
};

/**
 * Get lesson by slug within a course
 */
export const getLessonBySlug = async (courseId: string, slug: string): Promise<Lesson | null> => {
  return await prisma.lesson.findUnique({
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
          trainerId: true,
        },
      },
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
  });
};

/**
 * Create a new lesson (with transaction for type-specific data)
 * For video lessons: pass videoId
 * For text lessons: pass textContent and estimatedReadTime
 */
export const createLesson = async (data: {
  courseId: string;
  moduleId?: string;
  title: string;
  slug: string;
  type: LessonType;
  description?: string;
  sequence: number;
  duration?: number;
  isFree?: boolean;
  isMandatory?: boolean;
  status?: LessonStatus;
  metadata?: any;
  // Type-specific fields
  videoId?: string;
  textContent?: string;
  estimatedReadTime?: number;
}): Promise<Lesson> => {
  // Validate type-specific data
  if (data.type === LessonType.video && !data.videoId) {
    throw new Error("Video ID is required for video lessons");
  }

  if (data.type === LessonType.text && !data.textContent) {
    throw new Error("Text content is required for text lessons");
  }

  // Use transaction to create lesson + type-specific data
  return await prisma
    .$transaction(async (tx) => {
      // 1. Create main lesson
      const lesson = await tx.lesson.create({
        data: {
          courseId: data.courseId,
          ...(data.moduleId && { moduleId: data.moduleId }),
          title: data.title,
          slug: data.slug,
          type: data.type,
          description: data.description,
          sequence: data.sequence,
          duration: data.duration,
          isFree: data.isFree ?? false,
          isMandatory: data.isMandatory ?? true,
          status: data.status ?? LessonStatus.published,
          metadata: data.metadata,
        },
      });

      // 2. Create type-specific data
      if (data.type === LessonType.video) {
        await tx.videoLesson.create({
          data: {
            lessonId: lesson.id,
            videoId: data.videoId!,
          },
        });
      } else if (data.type === LessonType.text) {
        await tx.textLesson.create({
          data: {
            lessonId: lesson.id,
            content: data.textContent!,
            estimatedReadTime: data.estimatedReadTime,
          },
        });
      }

      // 3. Return lesson with type-specific data included
      const createdLesson = (await tx.lesson.findUnique({
        where: { id: lesson.id },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
          module: true,
          lessonDescription: true,
          lessonAttachments: {
            orderBy: { sequence: "asc" },
          },
        },
      })) as Lesson;

      return createdLesson;
    })
    .then(async (lesson) => {
      // Hook: Recalculate progress for all users when a lesson is added
      await onLessonAdded(lesson.courseId);
      return lesson;
    });
};

/**
 * Update lesson (with transaction for type-specific data)
 */
export const updateLesson = async (
  lessonId: string,
  data: {
    title?: string;
    slug?: string;
    description?: string;
    sequence?: number;
    duration?: number;
    isFree?: boolean;
    isMandatory?: boolean;
    status?: LessonStatus;
    metadata?: any;
    // Type-specific fields
    videoId?: string;
    textContent?: string;
    estimatedReadTime?: number;
  }
): Promise<Lesson> => {
  return await prisma
    .$transaction(async (tx) => {
      // Get existing lesson to know its type
      const existingLesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        include: {
          videoLesson: true,
          textLesson: true,
        },
      });

      if (!existingLesson) {
        throw new Error("Lesson not found");
      }

      // 1. Update main lesson
      const updateData: Prisma.LessonUpdateInput = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.sequence !== undefined) updateData.sequence = data.sequence;
      if (data.duration !== undefined) updateData.duration = data.duration;
      if (data.isFree !== undefined) updateData.isFree = data.isFree;
      if (data.isMandatory !== undefined) updateData.isMandatory = data.isMandatory;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      await tx.lesson.update({
        where: { id: lessonId },
        data: updateData,
      });

      // 2. Update type-specific data
      if (existingLesson.type === LessonType.video && data.videoId !== undefined) {
        await tx.videoLesson.upsert({
          where: { lessonId },
          update: { videoId: data.videoId },
          create: { lessonId, videoId: data.videoId },
        });
      } else if (existingLesson.type === LessonType.text) {
        const textUpdateData: any = {};
        if (data.textContent !== undefined) textUpdateData.content = data.textContent;
        if (data.estimatedReadTime !== undefined)
          textUpdateData.estimatedReadTime = data.estimatedReadTime;

        if (Object.keys(textUpdateData).length > 0) {
          await tx.textLesson.update({
            where: { lessonId },
            data: textUpdateData,
          });
        }
      }

      // 3. Return updated lesson
      const updatedLesson = (await tx.lesson.findUnique({
        where: { id: lessonId },
        include: {
          videoLesson: {
            include: {
              video: true,
            },
          },
          textLesson: true,
          module: true,
          lessonDescription: true,
          lessonAttachments: {
            orderBy: { sequence: "asc" },
          },
        },
      })) as Lesson;

      return {
        updatedLesson,
        statusChanged: data.status !== undefined && data.status !== existingLesson.status,
      };
    })
    .then(async ({ updatedLesson, statusChanged }) => {
      // Hook: Recalculate progress if status changed (affects which lessons count toward progress)
      if (statusChanged) {
        await onLessonStatusChanged(lessonId, updatedLesson.courseId);
      }
      return updatedLesson;
    });
};

/**
 * Delete lesson
 */
export const deleteLesson = async (lessonId: string): Promise<void> => {
  // Get lesson info before deletion
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true },
  });

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  await prisma.lesson.delete({
    where: { id: lessonId },
  });

  // Hook: Recalculate progress for all users when a lesson is deleted
  await onLessonDeleted(lessonId, lesson.courseId);
};

/**
 * Bulk update lesson sequences
 */
export const bulkUpdateLessonSequences = async (
  updates: Array<{ id: string; sequence: number }>
): Promise<void> => {
  await prisma.$transaction(
    updates.map((update) =>
      prisma.lesson.update({
        where: { id: update.id },
        data: { sequence: update.sequence },
      })
    )
  );
};

// ==================== LESSON ANALYTICS ====================

/**
 * Get free lessons for a course (for preview)
 */
export const getFreeLessons = async (courseId: string): Promise<Lesson[]> => {
  return await prisma.lesson.findMany({
    where: {
      courseId,
      isFree: true,
      status: LessonStatus.published,
    },
    include: {
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      module: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { sequence: "asc" },
  });
};

// ==================== NAVIGATION HELPERS ====================

/**
 * Get next lesson
 */
export const getNextLesson = async (
  courseId: string,
  currentSequence: number,
  moduleId?: string
): Promise<Lesson | null> => {
  return await prisma.lesson.findFirst({
    where: {
      courseId,
      ...(moduleId && { moduleId }),
      sequence: { gt: currentSequence },
      status: LessonStatus.published,
    },
    orderBy: { sequence: "asc" },
    include: {
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
  });
};

/**
 * Get previous lesson
 */
export const getPreviousLesson = async (
  courseId: string,
  currentSequence: number,
  moduleId?: string
): Promise<Lesson | null> => {
  return await prisma.lesson.findFirst({
    where: {
      courseId,
      ...(moduleId && { moduleId }),
      sequence: { lt: currentSequence },
      status: LessonStatus.published,
    },
    orderBy: { sequence: "desc" },
    include: {
      videoLesson: {
        include: {
          video: true,
        },
      },
      textLesson: true,
      lessonDescription: true,
      lessonAttachments: {
        orderBy: { sequence: "asc" },
      },
    },
  });
};

// ==================== LESSON DESCRIPTION MANAGEMENT ====================

/**
 * Create or update lesson description
 */
export const upsertLessonDescription = async (
  lessonId: string,
  textContent: string
): Promise<any> => {
  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  // Upsert description
  return await prisma.lessonDescription.upsert({
    where: { lessonId },
    create: {
      lessonId,
      textContent,
    },
    update: {
      textContent,
    },
  });
};

/**
 * Get lesson description
 */
export const getLessonDescription = async (lessonId: string): Promise<any | null> => {
  return await prisma.lessonDescription.findUnique({
    where: { lessonId },
  });
};

/**
 * Delete lesson description
 */
export const deleteLessonDescription = async (lessonId: string): Promise<void> => {
  await prisma.lessonDescription.delete({
    where: { lessonId },
  });
};

// ==================== LESSON ATTACHMENT MANAGEMENT ====================

/**
 * Add attachment to lesson
 */
export const addLessonAttachment = async (data: {
  lessonId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  type?: string;
  sequence?: number;
}): Promise<any> => {
  // Check if lesson exists
  const lesson = await prisma.lesson.findUnique({ where: { id: data.lessonId } });
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  // Determine attachment type from mimeType if not provided
  let attachmentType = data.type || "other";
  if (!data.type) {
    if (data.mimeType.startsWith("image/")) {
      attachmentType = "image";
    } else if (data.mimeType === "application/pdf") {
      attachmentType = "pdf";
    } else if (
      data.mimeType.includes("document") ||
      data.mimeType.includes("word") ||
      data.mimeType.includes("text")
    ) {
      attachmentType = "document";
    } else if (data.mimeType.includes("zip") || data.mimeType.includes("compressed")) {
      attachmentType = "zip";
    }
  }

  // Get next sequence if not provided
  let sequence = data.sequence;
  if (sequence === undefined) {
    const maxSequence = await prisma.lessonAttachment.findFirst({
      where: { lessonId: data.lessonId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    sequence = (maxSequence?.sequence ?? -1) + 1;
  }

  return await prisma.lessonAttachment.create({
    data: {
      lessonId: data.lessonId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      type: attachmentType as any,
      sequence,
    },
  });
};

/**
 * Get all attachments for a lesson
 */
export const getLessonAttachments = async (lessonId: string): Promise<any[]> => {
  return await prisma.lessonAttachment.findMany({
    where: { lessonId },
    orderBy: { sequence: "asc" },
  });
};

/**
 * Get single attachment by ID
 */
export const getLessonAttachmentById = async (attachmentId: string): Promise<any | null> => {
  return await prisma.lessonAttachment.findUnique({
    where: { id: attachmentId },
  });
};

/**
 * Update attachment metadata
 */
export const updateLessonAttachment = async (
  attachmentId: string,
  data: {
    title?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    type?: string;
    sequence?: number;
  }
): Promise<any> => {
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
  if (data.fileName !== undefined) updateData.fileName = data.fileName;
  if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
  if (data.mimeType !== undefined) updateData.mimeType = data.mimeType;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.sequence !== undefined) updateData.sequence = data.sequence;

  return await prisma.lessonAttachment.update({
    where: { id: attachmentId },
    data: updateData,
  });
};

/**
 * Delete attachment
 */
export const deleteLessonAttachment = async (attachmentId: string): Promise<void> => {
  await prisma.lessonAttachment.delete({
    where: { id: attachmentId },
  });
};

/**
 * Bulk update attachment sequences
 */
export const bulkUpdateAttachmentSequences = async (
  updates: Array<{ id: string; sequence: number }>
): Promise<void> => {
  await prisma.$transaction(
    updates.map((update) =>
      prisma.lessonAttachment.update({
        where: { id: update.id },
        data: { sequence: update.sequence },
      })
    )
  );
};

/**
 * Delete all attachments for a lesson
 */
export const deleteAllLessonAttachments = async (lessonId: string): Promise<void> => {
  await prisma.lessonAttachment.deleteMany({
    where: { lessonId },
  });
};

// ==================== PROGRESS TRACKING ====================
// Progress tracking will be implemented separately
