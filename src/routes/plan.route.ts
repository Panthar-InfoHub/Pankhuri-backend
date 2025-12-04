/**
 * Plan Routes
 * Subscription plan endpoints
 */

import express from "express";
import {
    createPlanHandler,
    getActivePlansHandler,
    getPlanBySlugHandler,
    getPlanByIdHandler,
    updatePlanHandler,
    deletePlanHandler,
} from "@/controllers/plan.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all active plans
router.get("/", getActivePlansHandler);

// Get plan by slug
router.get("/slug/:slug", getPlanBySlugHandler);

// Get plan by ID
router.get("/:id", authenticateWithSession, getPlanByIdHandler);
// ==================== ADMIN ROUTES ====================


// Create plan
router.post("/", authenticateWithSession, requireAdmin, createPlanHandler);

// Update plan
router.put("/:id", authenticateWithSession, requireAdmin, updatePlanHandler);

// Delete plan
router.delete("/:id", authenticateWithSession, requireAdmin, deletePlanHandler);

export default router;
