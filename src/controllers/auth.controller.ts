import { UserRole } from "@/prisma/generated/prisma/client";
import { verifyFirebaseToken } from "@services/auth.service";
import { Request, Response } from "express";
import { generateJWT } from "../lib/jwt";
import {
  findAdminByEmail,
  findOrCreateUserByEmail,
  findOrCreateUserByPhone,
} from "../services/user.service";
import { manageUserSessions } from "../services/session.service";

/**
 * Google OAuth login via Firebase
 * POST /api/auth/google
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Validation
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Firebase ID token is required",
      });
    }

    // Verify Firebase ID token
    const firebaseUser = await verifyFirebaseToken(idToken);
    console.log("Firebase User:", firebaseUser);

    if (!firebaseUser.email) {
      return res.status(400).json({
        success: false,
        error: "Email not found in token",
      });
    }

    // Find or create user
    const user = await findOrCreateUserByEmail(
      firebaseUser.email,
      firebaseUser.name,
      firebaseUser.picture
    );

    // Create session and manage max 2 sessions per user
    const session = await manageUserSessions(user.id);

    // Generate JWT with session ID
    const jwtToken = generateJWT(user, session.id);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: {
        token: jwtToken,
        sessionId: session.id,
        user: user,
      },
    });
  } catch (error: any) {
    console.error("Google login error:", error);

    if (error.message.includes("verification failed")) {
      return res.status(401).json({
        success: false,
        error: "Invalid Firebase token",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed",
    });
  }
};

/**
 * Phone/SMS authentication with Firebase
 * POST /api/auth/phone
 */
export const phoneLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Validation
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Firebase ID token is required",
      });
    }

    // Verify Firebase ID token
    const firebaseUser = await verifyFirebaseToken(idToken);
    console.log("Firebase User:", firebaseUser);

    if (!firebaseUser.phone_number) {
      return res.status(400).json({
        success: false,
        error: "Phone number not found in token",
      });
    }

    // Find or create user by phone (country code auto-extracted)
    const user = await findOrCreateUserByPhone(firebaseUser.phone_number);

    // Create session and manage max 2 sessions per user
    const session = await manageUserSessions(user.id);

    // Generate JWT with session ID
    const token = generateJWT(user, session.id);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Phone authentication successful",
      data: {
        token,
        sessionId: session.id,
        user: user,
      },
    });
  } catch (error: any) {
    console.error("Phone login error:", error);

    if (error.message.includes("verification failed")) {
      return res.status(401).json({
        success: false,
        error: "Invalid Firebase token",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed",
    });
  }
};

/**
 * Google OAuth admin verification
 * POST /api/auth/google-verify-admin
 */
export const googleVerifyAdmin = async (req: Request, res: Response) => {
  try {
    const { admin_mail } = req.body;

    // Validation
    if (!admin_mail) {
      return res.status(400).json({
        success: false,
        error: "Admin email is required",
      });
    }

    // Find user by email (don't create if not exists)
    const user = await findAdminByEmail(admin_mail);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Admin user not found",
      });
    }

    // Check if user has admin role
    if (user.role !== UserRole.admin) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required",
      });
    }

    // Create session and manage max 2 sessions per user
    const session = await manageUserSessions(user.id);

    // Generate JWT with session ID
    const jwtToken = generateJWT(user, session.id);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Admin authentication successful",
      data: {
        token: jwtToken,
        sessionId: session.id,
        user: user,
      },
    });
  } catch (error: any) {
    console.error("Admin Google login error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed",
    });
  }
};
