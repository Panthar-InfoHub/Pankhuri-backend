import { Request, Response } from "express";
import { verifyFirebaseToken, verifyGoogleToken } from "@services/auth.service";
import {
  findOrCreateUserByEmail,
  findOrCreateUserByPhone,
} from "../services/user.service";
import { generateJWT } from "../lib/jwt";

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Google token is required",
      });
    }

    // Verify Google OAuth token
    const googlePayload = await verifyGoogleToken(idToken);

    if (!googlePayload.email) {
      return res.status(400).json({
        success: false,
        error: "Email not found in token",
      });
    }

    // Find or create user
    const user = await findOrCreateUserByEmail(
      googlePayload.email,
      googlePayload.sub,
      googlePayload.name,
      googlePayload.picture
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
        error: "Invalid Google token",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Authentication failed",
    });
  }
};

export const phoneLogin = async (req: Request, res: Response) => {
  try {
    const { idToken, countryCode } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Firebase ID token is required",
      });
    }

    // Verify Firebase ID token directly
    const decodedToken = await verifyFirebaseToken(idToken);

    if (!decodedToken.phone_number) {
      return res.status(400).json({
        success: false,
        error: "Phone number not found in token",
      });
    }

    // Find or create user by phone
    const user = await findOrCreateUserByPhone(decodedToken.phone_number, countryCode);

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
