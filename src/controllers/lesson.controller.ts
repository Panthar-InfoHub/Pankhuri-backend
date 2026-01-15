import { Request, Response, NextFunction } from "express";
import {
  getLessonsByCourse,
  getLessonsByModule,
  getLessonById,
  getLessonBySlug,
  createLesson,
  updateLesson,
  deleteLesson,
  bulkUpdateLessonSequences,
  getFreeLessons,
  getNextLesson,
  getPreviousLesson,
  checkLessonAccess,
} from "@services/lesson.service";
import { LessonType, LessonStatus } from "@/prisma/generated/prisma/client";

// ==================== GET LESSONS ====================

/**
 * Get all lessons for a course
 * GET /api/lessons/course/:courseId
 * Shows all lessons (title, duration, etc.) - access control applied when opening individual lesson
 */
export const getLessonsByCourseHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;
    const { moduleId, type, status, isFree } = req.query;

    const filters = {
      moduleId: moduleId as string | undefined,
      type: type as LessonType | undefined,
      status: status as LessonStatus | undefined,
      isFree: isFree === "true" ? true : isFree === "false" ? false : undefined,
    };

    const lessons = await getLessonsByCourse(courseId, filters);

    return res.status(200).json({
      success: true,
      data: lessons,
      count: lessons.length,
    });
  } catch (error: any) {
    console.error("Error fetching lessons by course:", error);
    next(error);
  }
};

/**
 * Get lessons by module
 * GET /api/lessons/module/:moduleId
 * Shows all lessons (title, duration, etc.) - access control applied when opening individual lesson
 */
export const getLessonsByModuleHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { moduleId } = req.params;

    const lessons = await getLessonsByModule(moduleId);

    return res.status(200).json({
      success: true,
      data: lessons,
      count: lessons.length,
    });
  } catch (error: any) {
    console.error("Error fetching lessons by module:", error);
    next(error);
  }
};

/**
 * Get lesson by ID with access control
 * GET /api/lessons/:id
 */
export const getLessonByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Lesson and access have already been checked by requireLessonAccess middleware
    let lesson = (req as any).lesson;

    if (!lesson) {
      const { id } = req.params;
      const userId = req.user?.id;
      const { lesson: fetchedLesson, hasAccess, reason } = await checkLessonAccess(id, userId);

      if (!fetchedLesson) return res.status(404).json({ success: false, error: "Lesson not found" });
      if (!hasAccess)
        return res
          .status(403)
          .json({ success: false, error: reason || "Access denied", code: "SUBSCRIPTION_REQUIRED" });

      lesson = fetchedLesson;
    }

    // Get navigation (next/previous lessons)
    const [nextLesson, previousLesson] = await Promise.all([
      getNextLesson(lesson.courseId, lesson.sequence, lesson.moduleId || undefined),
      getPreviousLesson(lesson.courseId, lesson.sequence, lesson.moduleId || undefined),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...lesson,
        navigation: {
          next: nextLesson
            ? { id: nextLesson.id, title: nextLesson.title, slug: nextLesson.slug }
            : null,
          previous: previousLesson
            ? { id: previousLesson.id, title: previousLesson.title, slug: previousLesson.slug }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching lesson by ID:", error);
    next(error);
  }
};

/**
 * Get lesson by slug with access control
 * GET /api/lessons/course/:courseId/slug/:slug
 */
export const getLessonBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, slug } = req.params;
    const userId = req.user?.id;

    const lesson = await getLessonBySlug(courseId, slug);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: "Lesson not found",
      });
    }

    // Check lesson access
    const { hasAccess, reason } = await checkLessonAccess(lesson.id, userId);

    // If no access, return limited info
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: reason || "Access denied",
        code: "SUBSCRIPTION_REQUIRED",
        data: {
          id: lesson.id,
          title: lesson.title,
          isFree: lesson.isFree,
          requiresSubscription: !lesson.isFree,
        },
      });
    }

    // Get navigation (next/previous lessons)
    const [nextLesson, previousLesson] = await Promise.all([
      getNextLesson(lesson.courseId, lesson.sequence, lesson.moduleId || undefined),
      getPreviousLesson(lesson.courseId, lesson.sequence, lesson.moduleId || undefined),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...lesson,
        navigation: {
          next: nextLesson
            ? { id: nextLesson.id, title: nextLesson.title, slug: nextLesson.slug }
            : null,
          previous: previousLesson
            ? { id: previousLesson.id, title: previousLesson.title, slug: previousLesson.slug }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching lesson by slug:", error);
    next(error);
  }
};

/**
 * Get free/preview lessons for a course
 * GET /api/lessons/course/:courseId/free
 */
export const getFreeLessonsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;

    const lessons = await getFreeLessons(courseId);

    return res.status(200).json({
      success: true,
      data: lessons,
      count: lessons.length,
    });
  } catch (error: any) {
    console.error("Error fetching free lessons:", error);
    next(error);
  }
};

// ==================== CREATE/UPDATE/DELETE LESSONS ====================

/**
 * Create a new lesson (auto-detects video or text type)
 * POST /api/lessons
 */
export const createLessonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      courseId,
      moduleId,
      videoId,
      textContent,
      title,
      slug,
      description,
      sequence,
      duration,
      estimatedReadTime,
      isFree,
      isMandatory,
      metadata,
    } = req.body;

    // Auto-detect lesson type based on provided data
    const type = videoId ? LessonType.video : textContent ? LessonType.text : null;

    // Validation
    if (!courseId || !title || !slug || sequence === undefined) {
      return res.status(400).json({
        success: false,
        message: "courseId, title, slug, and sequence are required",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Either videoId (for video lesson) or textContent (for text lesson) is required",
      });
    }

    if (type === LessonType.video && !videoId) {
      return res.status(400).json({
        success: false,
        message: "videoId is required for video lessons",
      });
    }

    if (type === LessonType.text && !textContent) {
      return res.status(400).json({
        success: false,
        message: "textContent is required for text lessons",
      });
    }

    const lessonData = {
      courseId,
      moduleId,
      videoId,
      textContent,
      title,
      slug,
      type,
      description,
      sequence,
      duration,
      estimatedReadTime,
      isFree: isFree || false,
      isMandatory: isMandatory !== undefined ? isMandatory : true,
      metadata,
    };

    const lesson = await createLesson(lessonData);

    return res.status(201).json({
      success: true,
      message: `${type === LessonType.video ? "Video" : "Text"} lesson created successfully`,
      data: lesson,
    });
  } catch (error: any) {
    console.error("Error creating lesson:", error);
    next(error);
  }
};

/**
 * Update lesson
 * PUT /api/lessons/:id
 */
export const updateLessonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const lesson = await updateLesson(id, updates);

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      data: lesson,
    });
  } catch (error: any) {
    console.error("Error updating lesson:", error);
    next(error);
  }
};

/**
 * Delete lesson
 * DELETE /api/lessons/:id
 */
export const deleteLessonHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await deleteLesson(id);

    return res.status(200).json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting lesson:", error);
    next(error);
  }
};

/**
 * Bulk update lesson sequences
 * PATCH /api/lessons/sequences
 */
export const bulkUpdateSequencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: "Updates array is required",
      });
    }

    await bulkUpdateLessonSequences(updates);

    return res.status(200).json({
      success: true,
      message: "Lesson sequences updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating lesson sequences:", error);
    next(error);
  }
};

// ==================== LESSON STATUS ====================

/**
 * Update lesson status
 * PATCH /api/lessons/:id/status
 */
export const updateLessonStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (draft, published, or archived)",
      });
    }

    const lesson = await updateLesson(id, { status });

    return res.status(200).json({
      success: true,
      message: `Lesson ${status} successfully`,
      data: lesson,
    });
  } catch (error: any) {
    console.error("Error updating lesson status:", error);
    next(error);
  }
};

// ==================== LESSON DESCRIPTIONS ====================

/**
 * Create or update lesson description
 * PUT /api/lessons/:id/description
 */
export const upsertLessonDescriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { textContent } = req.body;

    if (!textContent || typeof textContent !== "string") {
      return res.status(400).json({
        success: false,
        message: "textContent is required and must be a string",
      });
    }

    const { upsertLessonDescription } = await import("@services/lesson.service");
    const description = await upsertLessonDescription(id, textContent);

    return res.status(200).json({
      success: true,
      message: "Lesson description saved successfully",
      data: description,
    });
  } catch (error: any) {
    console.error("Error upserting lesson description:", error);
    if (error.message === "Lesson not found") {
      return res.status(404).json({
        success: false,
        error: "Lesson not found",
      });
    }
    next(error);
  }
};

/**
 * Get lesson description
 * GET /api/lessons/:id/description
 */
export const getLessonDescriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const { getLessonDescription } = await import("@services/lesson.service");
    const description = await getLessonDescription(id);

    if (!description) {
      return res.status(404).json({
        success: false,
        message: "Lesson description not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: description,
    });
  } catch (error: any) {
    console.error("Error fetching lesson description:", error);
    next(error);
  }
};

/**
 * Delete lesson description
 * DELETE /api/lessons/:id/description
 */
export const deleteLessonDescriptionHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const { deleteLessonDescription } = await import("@services/lesson.service");
    await deleteLessonDescription(id);

    return res.status(200).json({
      success: true,
      message: "Lesson description deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting lesson description:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Lesson description not found",
      });
    }
    next(error);
  }
};

// ==================== LESSON ATTACHMENTS ====================

/**
 * Add attachment to lesson
 * POST /api/lessons/:id/attachments
 */
export const addLessonAttachmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: lessonId } = req.params;
    const { title, fileUrl, fileName, fileSize, mimeType, type, sequence } = req.body;

    // Validation
    if (!title || !fileUrl || !fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        message: "title, fileUrl, fileName, fileSize, and mimeType are required",
      });
    }

    const { addLessonAttachment } = await import("@services/lesson.service");
    const attachment = await addLessonAttachment({
      lessonId,
      title,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      type,
      sequence,
    });

    return res.status(201).json({
      success: true,
      message: "Attachment added successfully",
      data: attachment,
    });
  } catch (error: any) {
    console.error("Error adding lesson attachment:", error);
    if (error.message === "Lesson not found") {
      return res.status(404).json({
        success: false,
        error: "Lesson not found",
      });
    }
    next(error);
  }
};

/**
 * Get all attachments for a lesson
 * GET /api/lessons/:id/attachments
 */
export const getLessonAttachmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: lessonId } = req.params;

    const { getLessonAttachments } = await import("@services/lesson.service");
    const attachments = await getLessonAttachments(lessonId);

    return res.status(200).json({
      success: true,
      data: attachments,
      count: attachments.length,
    });
  } catch (error: any) {
    console.error("Error fetching lesson attachments:", error);
    next(error);
  }
};

/**
 * Get single attachment by ID
 * GET /api/lessons/attachments/:attachmentId
 */
export const getLessonAttachmentByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;

    const { getLessonAttachmentById } = await import("@services/lesson.service");
    const attachment = await getLessonAttachmentById(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: attachment,
    });
  } catch (error: any) {
    console.error("Error fetching attachment:", error);
    next(error);
  }
};

/**
 * Update attachment metadata
 * PUT /api/lessons/attachments/:attachmentId
 */
export const updateLessonAttachmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;
    const updates = req.body;

    const { updateLessonAttachment } = await import("@services/lesson.service");
    const attachment = await updateLessonAttachment(attachmentId, updates);

    return res.status(200).json({
      success: true,
      message: "Attachment updated successfully",
      data: attachment,
    });
  } catch (error: any) {
    console.error("Error updating attachment:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Attachment not found",
      });
    }
    next(error);
  }
};

/**
 * Delete attachment
 * DELETE /api/lessons/attachments/:attachmentId
 */
export const deleteLessonAttachmentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attachmentId } = req.params;

    const { deleteLessonAttachment } = await import("@services/lesson.service");
    await deleteLessonAttachment(attachmentId);

    return res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting attachment:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Attachment not found",
      });
    }
    next(error);
  }
};

/**
 * Bulk update attachment sequences
 * PATCH /api/lessons/attachments/sequences
 */
export const bulkUpdateAttachmentSequencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: "Updates array is required",
      });
    }

    const { bulkUpdateAttachmentSequences } = await import("@services/lesson.service");
    await bulkUpdateAttachmentSequences(updates);

    return res.status(200).json({
      success: true,
      message: "Attachment sequences updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating attachment sequences:", error);
    next(error);
  }
};

/**
 * Delete all attachments for a lesson
 * DELETE /api/lessons/:id/attachments/all
 */
export const deleteAllLessonAttachmentsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: lessonId } = req.params;

    const { deleteAllLessonAttachments } = await import("@services/lesson.service");
    await deleteAllLessonAttachments(lessonId);

    return res.status(200).json({
      success: true,
      message: "All attachments deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting all attachments:", error);
    next(error);
  }
};

// ==================== PROGRESS TRACKING ====================
// Progress tracking endpoints will be implemented separately
