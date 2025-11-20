import FirebaseAdmin from "@/config/firebase";

/**
 * Verify Firebase ID token (works for all auth methods: Google, Phone, etc.)
 * Returns decoded token with Firebase UID and user info
 */
export const verifyFirebaseToken = async (idToken: string) => {
  try {
    const decodedToken = await FirebaseAdmin.auth().verifyIdToken(idToken);

    // Return standardized user info from Firebase token
    return {
      uid: decodedToken.uid, // Firebase UID - unique across all platforms
      email: decodedToken.email,
      phone_number: decodedToken.phone_number,
      name: decodedToken.name,
      picture: decodedToken.picture,
      email_verified: decodedToken.email_verified,
      firebase: decodedToken, // Full decoded token if needed
    };
  } catch (error: any) {
    console.error("Firebase token verification error:", error);
    throw new Error("Invalid or expired authentication token");
  }
};
