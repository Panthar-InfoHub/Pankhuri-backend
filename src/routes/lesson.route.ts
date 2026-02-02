import express from "express";
import { authenticateWithSession, requireAdmin, optionalAuthenticate } from "@/middleware/session.middleware";
import { requireLessonAccess, requireAttachmentAccess } from "@/middleware/resource-access.middleware";
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
  upsertLessonDescriptionHandler,
  getLessonDescriptionHandler,
  deleteLessonDescriptionHandler,
  addLessonAttachmentHandler,
  getLessonAttachmentsHandler,
  getLessonAttachmentByIdHandler,
  updateLessonAttachmentHandler,
  deleteLessonAttachmentHandler,
  bulkUpdateAttachmentSequencesHandler,
  deleteAllLessonAttachmentsHandler,
} from "@/controllers/lesson.controller";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
// Lesson lists are public - show all lessons with title, duration, etc.

// Get lessons by course
router.get("/course/:courseId", optionalAuthenticate, getLessonsByCourseHandler);

// Get free lessons (preview)
router.get("/course/:courseId/free", optionalAuthenticate, getFreeLessonsHandler);

// Get lessons by module
router.get("/module/:moduleId", optionalAuthenticate, getLessonsByModuleHandler);

// ==================== AUTHENTICATED ROUTES ====================
// Individual lesson access requires authentication + subscription check

// Get lesson by ID (requires auth, checks subscription in middleware)
router.get("/:id", authenticateWithSession, requireLessonAccess, getLessonByIdHandler);

// Get lesson by slug (requires auth, checks subscription in controller - slug routes handle gating themselves currently)
router.get("/course/:courseSlug/slug/:slug", authenticateWithSession, getLessonBySlugHandler);

// ==================== ADMIN/TRAINER ROUTES ====================

// Create lesson (auto-detects video or text type)
router.post("/", authenticateWithSession, requireAdmin, createLessonHandler);

// Update lesson
router.put("/:id", authenticateWithSession, requireAdmin, updateLessonHandler);

// Delete lesson
router.delete("/:id", authenticateWithSession, requireAdmin, deleteLessonHandler);

// Bulk update sequences
router.patch("/sequences", authenticateWithSession, requireAdmin, bulkUpdateSequencesHandler);

// Update lesson status (draft/published/archived)
router.patch("/:id/status", authenticateWithSession, requireAdmin, updateLessonStatusHandler);

// ==================== LESSON DESCRIPTIONS ====================

// Create or update lesson description
router.put("/:id/description", authenticateWithSession, requireAdmin, upsertLessonDescriptionHandler);

// Get lesson description
router.get("/:id/description", authenticateWithSession, requireLessonAccess, getLessonDescriptionHandler);

// Delete lesson description
router.delete("/:id/description", authenticateWithSession, requireAdmin, deleteLessonDescriptionHandler);

// ==================== LESSON ATTACHMENTS ====================

// Add attachment to lesson
router.post("/:id/attachments", authenticateWithSession, requireAdmin, addLessonAttachmentHandler);

// Get all attachments for a lesson
router.get("/:id/attachments", authenticateWithSession, requireLessonAccess, getLessonAttachmentsHandler);

// Delete all attachments for a lesson
router.delete("/:id/attachments/all", authenticateWithSession, requireAdmin, deleteAllLessonAttachmentsHandler);

// Bulk update attachment sequences
router.patch(
  "/attachments/sequences",
  authenticateWithSession,
  requireAdmin,
  bulkUpdateAttachmentSequencesHandler
);

// Get single attachment by ID
router.get("/attachments/:attachmentId", authenticateWithSession, requireAttachmentAccess, getLessonAttachmentByIdHandler);

// Update attachment metadata
router.put("/attachments/:attachmentId", authenticateWithSession, requireAdmin, updateLessonAttachmentHandler);

// Delete attachment
router.delete("/attachments/:attachmentId", authenticateWithSession, requireAdmin, deleteLessonAttachmentHandler);

export default router;
