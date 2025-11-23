import express from "express";
import { authenticateWithSession } from "@/middleware/session.middleware";
import {
  getLessonsByCourseHandler,
  getLessonsByModuleHandler,
  getLessonByIdHandler,
  getLessonBySlugHandler,
  getFreeLessonsHandler,
  createLessonHandler,
  updateLessonHandler,
  deleteLessonHandler,
  bulkUpdateSequencesHandler,
  updateLessonStatusHandler,
} from "@/controllers/lesson.controller";

const router = express.Router();

// ==================== PUBLIC/AUTHENTICATED ROUTES ====================

// Get lessons by course
router.get("/course/:courseId", authenticateWithSession, getLessonsByCourseHandler);

// Get free lessons (preview)
router.get("/course/:courseId/free", getFreeLessonsHandler);

// Get lessons by module
router.get("/module/:moduleId", authenticateWithSession, getLessonsByModuleHandler);

// Get lesson by ID
router.get("/:id", authenticateWithSession, getLessonByIdHandler);

// Get lesson by slug
router.get("/course/:courseId/slug/:slug", authenticateWithSession, getLessonBySlugHandler);

// ==================== ADMIN/TRAINER ROUTES ====================

// Create lesson (auto-detects video or text type)
router.post("/", authenticateWithSession, createLessonHandler);

// Update lesson
router.put("/:id", authenticateWithSession, updateLessonHandler);

// Delete lesson
router.delete("/:id", authenticateWithSession, deleteLessonHandler);

// Bulk update sequences
router.patch("/sequences", bulkUpdateSequencesHandler);

// Update lesson status (draft/published/archived)
router.patch("/:id/status", authenticateWithSession, updateLessonStatusHandler);

export default router;
