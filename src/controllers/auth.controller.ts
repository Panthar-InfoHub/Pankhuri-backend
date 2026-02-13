import { UserRole } from "@/prisma/generated/prisma/client";
import { verifyFirebaseToken } from "@services/auth.service";
import { Request, Response } from "express";
import { generateJWT } from "../lib/jwt";
import {
  findAdminByEmail,
  findOrCreateUserByEmail,
  findOrCreateUserByPhone,
} from "../services/user.service";
import { manageUserSessions, updateSessionFcmToken } from "../services/session.service";
import { requestPhoneOtp, verifyPhoneOtp } from "../services/otp.service";

/**
 * Google OAuth login via Firebase
 * POST /api/auth/google
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken, fcmToken } = req.body;

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

    // Create session with FCM token (manages max 2 sessions automatically)
    const session = await manageUserSessions(user.id, fcmToken);

    // Generate JWT with session ID
    const jwtToken = generateJWT(user, session.id);

    // Check if onboarding is completed
    const isOnboardingCompleted = !!(user.displayName && user.dateOfBirth && user.gender);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: {
        token: jwtToken,
        sessionId: session.id,
        user: user,
        isOnboardingCompleted,
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
    const { idToken, fcmToken } = req.body;

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

    // Create session with FCM token (manages max 2 sessions automatically)
    const session = await manageUserSessions(user.id, fcmToken);

    // Generate JWT with session ID
    const token = generateJWT(user, session.id);

    // Check if onboarding is completed
    const isOnboardingCompleted = !!(user.displayName && user.dateOfBirth && user.gender);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Phone authentication successful",
      data: {
        token,
        sessionId: session.id,
        user: user,
        isOnboardingCompleted,
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
    console.log("Admin User:", user);

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

/**
 * Update FCM Token for current session
 * POST /api/auth/fcm-token
 */
export const updateFcmToken = async (req: Request, res: Response) => {
  try {
    const { fcmToken } = req.body;
    const sessionId = req.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: "FCM token is required",
      });
    }

    // Update session with new token (old token automatically replaced)
    await updateSessionFcmToken(sessionId, fcmToken);

    return res.status(200).json({
      success: true,
      message: "FCM token updated successfully",
    });
  } catch (error: any) {
    console.error("Update FCM token error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update FCM token",
    });
  }
};

/**
 * Tester Login (BYPASS FIREBASE)
 * ONLY FOR LOCAL TESTING/DEVELOPMENT
 * POST /api/auth/tester-login
 */
export const testerLogin = async (req: Request, res: Response) => {
  try {
    const { email, fcmToken } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    // Find user by email
    const user = await findOrCreateUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Create session
    const session = await manageUserSessions(user.id, fcmToken);

    // Generate JWT
    const token = generateJWT(user, session.id);

    return res.status(200).json({
      success: true,
      message: "Tester login successful",
      data: {
        token,
        sessionId: session.id,
        user: user,
      },
    });
  } catch (error: any) {
    console.error("Tester login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Tester login failed",
    });
  }
};

/**
 * Request OTP for phone login
 * POST /api/auth/otp/request
 */
export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    const result = await requestPhoneOtp(phone);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Request OTP error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to request OTP",
    });
  }
};

/**
 * Verify OTP and login/signup
 * POST /api/auth/otp/verify
 */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp, fcmToken } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        error: "Phone and OTP are required",
      });
    }

    // 1. Verify OTP
    try {
      await verifyPhoneOtp(phone, otp);
    } catch (otpError: any) {
      return res.status(400).json({
        success: false,
        error: otpError.message,
      });
    }

    // 2. OTP is valid, proceed to login/signup
    // The phone passed to findOrCreateUserByPhone should be formatted by the service itself
    // but for consistency we use the same formatting logic.
    // However, verifyPhoneOtp already uses formatPhoneNumber, so we'll just use the raw phone
    // as findOrCreateUserByPhone also handles it via sub-services.
    // Actually, to be safe and avoid double country codes, we'll let the service handle it.

    // We already know phone is valid from verifyPhoneOtp.
    // Re-importing formatPhoneNumber to ensure we pass the same ID to user service if needed
    // or just let userService handle it.
    const user = await findOrCreateUserByPhone(phone);

    // 3. Create session
    const session = await manageUserSessions(user.id, fcmToken);

    // 4. Generate JWT
    const token = generateJWT(user, session.id);

    // 5. Check onboarding
    const isOnboardingCompleted = !!(user.displayName && user.dateOfBirth && user.gender);

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        token,
        sessionId: session.id,
        user,
        isOnboardingCompleted,
      },
    });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed",
    });
  }
};
