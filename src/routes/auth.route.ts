import express from "express";
import { googleLogin, phoneLogin, googleVerifyAdmin, updateFcmToken, testerLogin, requestOtp, verifyOtp } from "../controllers/auth.controller";
import { authenticateWithSession } from "../middleware/session.middleware";

const router = express.Router();


router.post("/google-verify", googleLogin);
router.post("/tester-login", testerLogin);
router.post("/phone-verify", phoneLogin); // still here so nothing breaks while we are switching to otp from msg91
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.post("/google-verify-admin", googleVerifyAdmin);
router.post("/fcm-token", authenticateWithSession, updateFcmToken);

export default router;
