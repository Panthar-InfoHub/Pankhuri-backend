import express from "express";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";
import {
  getModulesByCourseHandler,
  getModuleByIdHandler,
  getModuleBySlugHandler,
  createModuleHandler,
  updateModuleHandler,
  deleteModuleHandler,
  bulkUpdateSequencesHandler,
  updateModuleStatusHandler,
  updateModuleDurationHandler,
} from "@/controllers/module.controller";

const router = express.Router();

// ==================== PUBLIC/AUTHENTICATED ROUTES ====================

// Get modules by course
router.get("/course/:courseId", authenticateWithSession, getModulesByCourseHandler);

// Get module by ID
router.get("/:id", authenticateWithSession, getModuleByIdHandler);

// Get module by slug
router.get("/course/:courseId/slug/:slug", authenticateWithSession, getModuleBySlugHandler);

// ==================== ADMIN/TRAINER ROUTES ====================

// Create module
router.post("/", authenticateWithSession, requireAdmin, createModuleHandler);

// Update module
router.put("/:id", authenticateWithSession, requireAdmin, updateModuleHandler);

// Delete module
router.delete("/:id", authenticateWithSession, requireAdmin, deleteModuleHandler);

// Bulk update sequences
router.patch("/sequences", authenticateWithSession, requireAdmin, bulkUpdateSequencesHandler);

// Update module status (draft/published/archived)
router.patch("/:id/status", authenticateWithSession, requireAdmin, updateModuleStatusHandler);

// Update module duration
router.patch("/:id/duration", authenticateWithSession, requireAdmin, updateModuleDurationHandler);

export default router;
