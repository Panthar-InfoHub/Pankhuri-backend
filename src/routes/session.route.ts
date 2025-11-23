import express from "express";
import {
    getUserActiveSessions,
    getAllSessions,
    logoutCurrentSession,
    logoutSpecificSession,
    logoutAllSessions,
    cleanupSessions,
} from "../controllers/session.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = express.Router();

// All routes require authentication with session management
router.use(authenticateWithSession);

// Get active sessions for current user
router.get("/active", getUserActiveSessions);

// Get all sessions (including expired) for current user
router.get("/", getAllSessions);

// Logout from current session
router.delete("/current", logoutCurrentSession);

// Logout from specific session
router.delete("/:sessionId", logoutSpecificSession);

// Logout from all sessions
router.delete("/all/logout", logoutAllSessions);

// Cleanup expired sessions (Admin only)
router.post("/cleanup", requireAdmin, cleanupSessions);

export default router;
