import { Request, Response } from "express";
import {
  getActiveSessions,
  getAllUserSessions,
  deleteSession,
  deleteAllUserSessions,
  cleanupExpiredSessions,
} from "../services/session.service";

/**
 * Get all active sessions for the authenticated user
 * GET /api/sessions/active
 */
export const getUserActiveSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const sessions = await getActiveSessions(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });
  } catch (error: any) {
    console.error("Get active sessions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch sessions",
    });
  }
};

/**
 * Get all sessions (including expired) for the authenticated user
 * GET /api/sessions
 */
export const getAllSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const sessions = await getAllUserSessions(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });
  } catch (error: any) {
    console.error("Get all sessions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch sessions",
    });
  }
};

/**
 * Logout from current session
 * DELETE /api/sessions/current
 */
export const logoutCurrentSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!req.sessionId) {
      return res.status(400).json({
        success: false,
        error: "No session ID found",
      });
    }

    await deleteSession(req.sessionId);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Logout failed",
    });
  }
};

/**
 * Logout from a specific session
 * DELETE /api/sessions/:sessionId
 */
export const logoutSpecificSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required",
      });
    }

    // Verify session belongs to the user
    const sessions = await getAllUserSessions(req.user.id);
    const sessionExists = sessions.find((s) => s.id === sessionId);

    if (!sessionExists) {
      return res.status(404).json({
        success: false,
        error: "Session not found or does not belong to you",
      });
    }

    await deleteSession(sessionId);

    return res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error: any) {
    console.error("Logout specific session error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to terminate session",
    });
  }
};

/**
 * Logout from all sessions (logout everywhere)
 * DELETE /api/sessions/all
 */
export const logoutAllSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    await deleteAllUserSessions(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Logged out from all sessions successfully",
    });
  } catch (error: any) {
    console.error("Logout all sessions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to logout from all sessions",
    });
  }
};

/**
 * Clean up expired sessions (Admin only - can be called by cron job)
 * POST /api/sessions/cleanup
 */
export const cleanupSessions = async (req: Request, res: Response) => {
  try {
    const count = await cleanupExpiredSessions();

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${count} expired sessions`,
      data: {
        deletedCount: count,
      },
    });
  } catch (error: any) {
    console.error("Cleanup sessions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to cleanup sessions",
    });
  }
};
