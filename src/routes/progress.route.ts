import express from "express";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";
import {
  markLessonCompleteHandler,
  updateLessonTimestampHandler,
  getUserLessonProgressHandler,
  getUserCourseLessonProgressHandler,
  getUserCourseProgressHandler,
  getCourseProgressWithDetailsHandler,
  getUserAllCourseProgressHandler,
  getUserCompletedCoursesHandler,
  getUserInProgressCoursesHandler,
  getUserProgressSummaryHandler,
  getCourseProgressStatsHandler,
  resetUserCourseProgressHandler,
  recalculateUserCourseProgressHandler,
  recalculateAllUsersProgressHandler,
} from "@/controllers/progress.controller";

const router = express.Router();

// ==================== USER LESSON PROGRESS ====================

// Mark lesson as completed
router.post("/lessons/:lessonId/complete", authenticateWithSession, markLessonCompleteHandler);

// Update lesson watch progress (timestamp)
router.patch("/lessons/:lessonId/timestamp", authenticateWithSession, updateLessonTimestampHandler);

// Get user's progress for a specific lesson
router.get("/lessons/:lessonId", authenticateWithSession, getUserLessonProgressHandler);

// Get all lesson progress for a course
router.get(
  "/courses/:courseId/lessons",
  authenticateWithSession,
  getUserCourseLessonProgressHandler
);

// ==================== USER COURSE PROGRESS ====================

// Get user's progress for a specific course
router.get("/courses/:courseId", authenticateWithSession, getUserCourseProgressHandler);

// Get detailed progress for a course (includes lesson breakdown)
router.get(
  "/courses/:courseId/details",
  authenticateWithSession,
  getCourseProgressWithDetailsHandler
);

// Get all course progress for authenticated user
router.get("/courses", authenticateWithSession, getUserAllCourseProgressHandler);

// Get completed courses for authenticated user
router.get("/completed", authenticateWithSession, getUserCompletedCoursesHandler);

// Get in-progress courses for authenticated user
router.get("/in-progress", authenticateWithSession, getUserInProgressCoursesHandler);

// Get progress summary for authenticated user
router.get("/summary", authenticateWithSession, getUserProgressSummaryHandler);

// ==================== ADMIN ROUTES ====================

// Get progress statistics for a course (admin only)
router.get("/courses/:courseId/stats", authenticateWithSession, requireAdmin, getCourseProgressStatsHandler);

// Reset user progress for a course (admin only)
router.delete(
  "/users/:userId/courses/:courseId",
  authenticateWithSession,
  requireAdmin,
  resetUserCourseProgressHandler
);

// Recalculate course progress for a specific user (admin only)
router.post(
  "/users/:userId/courses/:courseId/recalculate",
  authenticateWithSession,
  requireAdmin,
  recalculateUserCourseProgressHandler
);

// Recalculate progress for all users in a course (admin only)
router.post(
  "/courses/:courseId/recalculate",
  authenticateWithSession,
  requireAdmin,
  recalculateAllUsersProgressHandler
);

export default router;
