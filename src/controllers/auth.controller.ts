import { Request, Response } from "express";
import { verifyFirebaseToken } from "@services/auth.service";
import { findOrCreateUserByEmail, findOrCreateUserByPhone } from "../services/user.service";
import { generateJWT } from "../lib/jwt";

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

    // Generate JWT
    const jwtToken = generateJWT(user);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: {
        token: jwtToken,
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

    // Generate JWT
    const token = generateJWT(user);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Phone authentication successful",
      data: {
        token,
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
