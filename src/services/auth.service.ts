import FirebaseAdmin from "@/config/firebase";
import { oauth2Client } from "@/config/googleAuth";

export const verifyGoogleToken = async (idToken: string) => {
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_ANDROID_CLIENT_ID!,
        process.env.GOOGLE_IOS_CLIENT_ID!,
      ],
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid Google token");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
    };
  } catch (error: any) {
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

//todo - make it work using userid - and in all platform
export const verifyFirebaseToken = async (idToken: string) => {
  try {
    const decodedToken = await FirebaseAdmin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }
};
