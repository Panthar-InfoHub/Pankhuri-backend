import express from "express";
import { authenticate } from "@/middleware/auth.middleware";
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
router.get("/course/:courseId", authenticate, getLessonsByCourseHandler);

// Get free lessons (preview)
router.get("/course/:courseId/free", getFreeLessonsHandler);

// Get lessons by module
router.get("/module/:moduleId", authenticate, getLessonsByModuleHandler);

// Get lesson by ID
router.get("/:id", authenticate, getLessonByIdHandler);

// Get lesson by slug
router.get("/course/:courseId/slug/:slug", authenticate, getLessonBySlugHandler);

// ==================== ADMIN/TRAINER ROUTES ====================

// Create lesson (auto-detects video or text type)
router.post("/", authenticate, createLessonHandler);

// Update lesson
router.put("/:id", authenticate, updateLessonHandler);

// Delete lesson
router.delete("/:id", authenticate, deleteLessonHandler);

// Bulk update sequences
router.patch("/sequences", authenticate, bulkUpdateSequencesHandler);

// Update lesson status (draft/published/archived)
router.patch("/:id/status", authenticate, updateLessonStatusHandler);

export default router;
