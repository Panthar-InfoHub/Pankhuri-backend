import express from "express";
import { googleLogin, phoneLogin, googleVerifyAdmin, updateFcmToken } from "../controllers/auth.controller";
import { authenticateWithSession } from "../middleware/session.middleware";

const router = express.Router();


router.post("/google-verify", googleLogin);
router.post("/phone-verify", phoneLogin);
router.post("/google-verify-admin", googleVerifyAdmin);
router.post("/fcm-token", authenticateWithSession, updateFcmToken);

export default router;
