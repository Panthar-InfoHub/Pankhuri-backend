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

// ==================== LESSON DESCRIPTIONS ====================

// Create or update lesson description
router.put("/:id/description", authenticateWithSession, upsertLessonDescriptionHandler);

// Get lesson description
router.get("/:id/description", authenticateWithSession, getLessonDescriptionHandler);

// Delete lesson description
router.delete("/:id/description", authenticateWithSession, deleteLessonDescriptionHandler);

// ==================== LESSON ATTACHMENTS ====================

// Add attachment to lesson
router.post("/:id/attachments", authenticateWithSession, addLessonAttachmentHandler);

// Get all attachments for a lesson
router.get("/:id/attachments", authenticateWithSession, getLessonAttachmentsHandler);

// Delete all attachments for a lesson
router.delete("/:id/attachments/all", authenticateWithSession, deleteAllLessonAttachmentsHandler);

// Bulk update attachment sequences
router.patch(
  "/attachments/sequences",
  authenticateWithSession,
  bulkUpdateAttachmentSequencesHandler
);

// Get single attachment by ID
router.get("/attachments/:attachmentId", authenticateWithSession, getLessonAttachmentByIdHandler);

// Update attachment metadata
router.put("/attachments/:attachmentId", authenticateWithSession, updateLessonAttachmentHandler);

// Delete attachment
router.delete("/attachments/:attachmentId", authenticateWithSession, deleteLessonAttachmentHandler);

export default router;
