import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../lib/jwt";
import { UserRole } from "@/prisma/generated/prisma/client";
import { manageUserSessions, validateSession } from "../services/session.service";

// Extend Express Request to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        phone?: string;
        role: UserRole;
        status: string;
      };
      sessionId?: string;
    }
  }
}

/**
 * Verify JWT token, manage sessions, and attach user to request
 * Ensures user has maximum 2 active sessions
 */
export const authenticateWithSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        code: "NO_TOKEN",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const decoded = verifyJWT(token);
      req.user = decoded;

      // Session ID is embedded in JWT token
      const sessionId = decoded.sessionId;

      if (sessionId) {
        // Validate existing session from JWT
        const session = await validateSession(sessionId);

        if (!session) {
          console.warn("Either session expired or invalid \n ");
          return res.status(401).json({
            success: false,
            message: "Invalid or expired session. Please login again.",
            code: "SESSION_EXPIRED",
          });
        }

        // Verify session belongs to the authenticated user
        if (session.userId !== decoded.id) {
          console.warn("Session does not belong to authenticated user \n ");
          return res.status(403).json({
            success: false,
            message: "Session does not belong to authenticated user",
            code: "SESSION_MISMATCH",
          });
        }

        req.sessionId = sessionId;
      } else {
        // Remove the oldest session and create a new one
        // Old token without session ID - create/manage sessions
        const newSession = await manageUserSessions(decoded.id);
        req.sessionId = newSession.id;
      }

      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please login again.",
        code: "INVALID_TOKEN",
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is admin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (req.user.role !== UserRole.admin) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
      code: "FORBIDDEN",
    });
  }

  next();
};
