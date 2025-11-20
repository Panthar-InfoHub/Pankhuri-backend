import express from "express";
import { authenticate } from "@/middleware/auth.middleware";
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
router.get("/course/:courseId", authenticate, getModulesByCourseHandler);

// Get module by ID
router.get("/:id", authenticate, getModuleByIdHandler);

// Get module by slug
router.get("/course/:courseId/slug/:slug", authenticate, getModuleBySlugHandler);

// ==================== ADMIN/TRAINER ROUTES ====================

// Create module
router.post("/", authenticate, createModuleHandler);

// Update module
router.put("/:id", authenticate, updateModuleHandler);

// Delete module
router.delete("/:id", authenticate, deleteModuleHandler);

// Bulk update sequences
router.patch("/sequences", authenticate, bulkUpdateSequencesHandler);

// Update module status (draft/published/archived)
router.patch("/:id/status", authenticate, updateModuleStatusHandler);

// Update module duration
router.patch("/:id/duration", authenticate, updateModuleDurationHandler);

export default router;
