import { Request, Response, NextFunction } from "express";
import {
  markLessonComplete,
  updateLessonTimestamp,
  getUserLessonProgress,
  getUserCourseLessonProgress,
  getUserCourseProgress,
  getUserAllCourseProgress,
  getCourseProgressWithDetails,
  getUserCompletedCourses,
  getUserInProgressCourses,
  getCourseProgressStats,
  getUserProgressSummary,
  resetUserCourseProgress,
  recalculateCourseProgress,
  recalculateAllUsersProgress,
} from "@services/progress.service";

// ==================== LESSON PROGRESS ====================

/**
 * Mark a lesson as completed
 * POST /api/progress/lessons/:lessonId/complete
 */
export const markLessonCompleteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { lessonId } = req.params;
    const { currentTimestamp } = req.body;
    const userId = req.user?.id; // Assuming auth middleware sets req.user

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const progress = await markLessonComplete(userId, lessonId, currentTimestamp);

    return res.status(200).json({
      success: true,
      message: "Lesson marked as completed",
      data: progress,
    });
  } catch (error: any) {
    console.error("Error marking lesson complete:", error);
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
 * Update lesson watch progress (timestamp)
 * PATCH /api/progress/lessons/:lessonId/timestamp
 */
export const updateLessonTimestampHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { lessonId } = req.params;
    const { currentTimestamp } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (currentTimestamp === undefined || typeof currentTimestamp !== "number") {
      return res.status(400).json({
        success: false,
        message: "currentTimestamp is required and must be a number",
      });
    }

    const progress = await updateLessonTimestamp(userId, lessonId, currentTimestamp);

    return res.status(200).json({
      success: true,
      message: "Lesson progress updated",
      data: progress,
    });
  } catch (error: any) {
    console.error("Error updating lesson timestamp:", error);
    next(error);
  }
};

/**
 * Get user's progress for a specific lesson
 * GET /api/progress/lessons/:lessonId
 */
export const getUserLessonProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const progress = await getUserLessonProgress(userId, lessonId);

    if (!progress) {
      return res.status(200).json({
        success: true,
        message: "No progress found for this lesson",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    console.error("Error fetching lesson progress:", error);
    next(error);
  }
};

/**
 * Get all lesson progress for a course
 * GET /api/progress/courses/:courseId/lessons
 */
export const getUserCourseLessonProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const progress = await getUserCourseLessonProgress(userId, courseId);

    return res.status(200).json({
      success: true,
      data: progress,
      count: progress.length,
    });
  } catch (error: any) {
    console.error("Error fetching course lesson progress:", error);
    next(error);
  }
};

// ==================== COURSE PROGRESS ====================

/**
 * Get user's progress for a specific course
 * GET /api/progress/courses/:courseId
 */
export const getUserCourseProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const progress = await getUserCourseProgress(userId, courseId);

    if (!progress) {
      return res.status(200).json({
        success: true,
        message: "No progress found for this course",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    console.error("Error fetching course progress:", error);
    next(error);
  }
};

/**
 * Get detailed progress for a course (includes lesson breakdown)
 * GET /api/progress/courses/:courseId/details
 */
export const getCourseProgressWithDetailsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const details = await getCourseProgressWithDetails(userId, courseId);

    return res.status(200).json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    console.error("Error fetching course progress details:", error);
    next(error);
  }
};

/**
 * Get all course progress for a user
 * GET /api/progress/courses
 */
export const getUserAllCourseProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const progress = await getUserAllCourseProgress(userId);

    return res.status(200).json({
      success: true,
      data: progress,
      count: progress.length,
    });
  } catch (error: any) {
    console.error("Error fetching all course progress:", error);
    next(error);
  }
};

/**
 * Get completed courses for a user
 * GET /api/progress/completed
 */
export const getUserCompletedCoursesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const courses = await getUserCompletedCourses(userId);

    return res.status(200).json({
      success: true,
      data: courses,
      count: courses.length,
    });
  } catch (error: any) {
    console.error("Error fetching completed courses:", error);
    next(error);
  }
};

/**
 * Get in-progress courses for a user
 * GET /api/progress/in-progress
 */
export const getUserInProgressCoursesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const courses = await getUserInProgressCourses(userId);

    return res.status(200).json({
      success: true,
      data: courses,
      count: courses.length,
    });
  } catch (error: any) {
    console.error("Error fetching in-progress courses:", error);
    next(error);
  }
};

/**
 * Get progress summary for a user
 * GET /api/progress/summary
 */
export const getUserProgressSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const summary = await getUserProgressSummary(userId);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error("Error fetching progress summary:", error);
    next(error);
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get progress statistics for a course (admin)
 * GET /api/progress/courses/:courseId/stats
 * Requires admin role
 */
export const getCourseProgressStatsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;

    const stats = await getCourseProgressStats(courseId);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching course progress stats:", error);
    next(error);
  }
};

/**
 * Reset user progress for a course (admin)
 * DELETE /api/progress/users/:userId/courses/:courseId
 * Requires admin role
 */
export const resetUserCourseProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, courseId } = req.params;

    await resetUserCourseProgress(userId, courseId);

    return res.status(200).json({
      success: true,
      message: "User course progress reset successfully",
    });
  } catch (error: any) {
    console.error("Error resetting user course progress:", error);
    next(error);
  }
};

/**
 * Recalculate course progress for a specific user (admin)
 * POST /api/progress/users/:userId/courses/:courseId/recalculate
 * Requires admin role
 */
export const recalculateUserCourseProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, courseId } = req.params;
    const progress = await recalculateCourseProgress(userId, courseId);

    return res.status(200).json({
      success: true,
      message: "Course progress recalculated successfully",
      data: progress,
    });
  } catch (error: any) {
    console.error("Error recalculating user course progress:", error);
    next(error);
  }
};

/**
 * Recalculate progress for all users in a course (admin)
 * POST /api/progress/courses/:courseId/recalculate
 * Requires admin role
 */
export const recalculateAllUsersProgressHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;

    await recalculateAllUsersProgress(courseId);

    return res.status(200).json({
      success: true,
      message: "Progress recalculated for all users in the course",
    });
  } catch (error: any) {
    console.error("Error recalculating all users progress:", error);
    next(error);
  }
};
