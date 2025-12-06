import express from "express";
import * as streakController from "../controllers/streak.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES (Authenticated) ====================

/**
 * GET /api/streak
 * Get current user's streak statistics
 */
router.get("/", authenticateWithSession, streakController.getCurrentUserStreak);

/**
 * POST /api/streak/activity
 * Record user activity and update streak
 */
router.post("/activity", authenticateWithSession, streakController.recordActivity);

/**
 * GET /api/streak/leaderboard
 * Get streak leaderboard (current streaks)
 */
router.get("/leaderboard", streakController.getLeaderboard);

/**
 * GET /api/streak/leaderboard/all-time
 * Get all-time streak leaderboard (longest streaks)
 */
router.get("/leaderboard/all-time", streakController.getAllTimeLeaderboard);

/**
 * GET /api/streak/rank
 * Get current user's streak rank
 */
router.get("/rank", authenticateWithSession, streakController.getCurrentUserRank);

/**
 * POST /api/streak/check-expiry
 * Check and update streak expiry for current user
 */
router.post("/check-expiry", authenticateWithSession, streakController.checkStreakExpiry);

/**
 * DELETE /api/streak/reset
 * Reset current user's streak
 */
router.delete("/reset", authenticateWithSession, streakController.resetStreak);

// ==================== ADMIN ROUTES ====================

/**
 * GET /api/streak/admin/user/:userId
 * Get specific user's streak (admin only)
 */
router.get(
  "/admin/user/:userId",
  authenticateWithSession,
  requireAdmin,
  streakController.getUserStreakById
);

/**
 * POST /api/streak/admin/bulk-check-expiry
 * Check streak expiry for all users (admin only, can be used with cron)
 */
router.post(
  "/admin/bulk-check-expiry",
  authenticateWithSession,
  requireAdmin,
  streakController.bulkCheckExpiry
);

/**
 * DELETE /api/streak/admin/reset/:userId
 * Reset specific user's streak (admin only)
 */
router.delete(
  "/admin/reset/:userId",
  authenticateWithSession,
  requireAdmin,
  streakController.resetUserStreakById
);

export default router;
