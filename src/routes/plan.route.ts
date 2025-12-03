/**
 * Plan Routes
 * Subscription plan endpoints
 */

import express from "express";
import {
    createPlanHandler,
    getActivePlansHandler,
    getAllPlansHandler,
    getPlanBySlugHandler,
    getPlanByIdHandler,
    updatePlanHandler,
    deletePlanHandler,
    syncPlanHandler,
} from "@/controllers/plan.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all active plans
router.get("/", getActivePlansHandler);

// Get plan by slug
router.get("/slug/:slug", getPlanBySlugHandler);

// ==================== ADMIN ROUTES ====================

// Get all plans (including inactive)
router.get("/all", authenticateWithSession , requireAdmin, getAllPlansHandler);

// Get plan by ID
router.get("/:id", authenticateWithSession, requireAdmin, getPlanByIdHandler);

// Create plan
router.post("/", authenticateWithSession, requireAdmin, createPlanHandler);

// Update plan
router.put("/:id", authenticateWithSession, requireAdmin, updatePlanHandler);

// Delete plan
router.delete("/:id", authenticateWithSession, requireAdmin, deletePlanHandler);

// Sync plan to payment gateway
router.post("/:id/sync", authenticateWithSession, requireAdmin, syncPlanHandler);

export default router;
