import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../lib/jwt";
import { UserRole } from "@/prisma/generated/prisma/client";

// Extend Express Request to include user
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
 * Verify JWT token and attach user to request
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const decoded = verifyJWT(token);
      req.user = decoded;
      req.sessionId = decoded.sessionId;
      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
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
    });
  }

  next();
};
