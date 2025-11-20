import express from "express";
import { googleLogin, phoneLogin, googleVerifyAdmin } from "../controllers/auth.controller";

const router = express.Router();


router.post("/google-verify", googleLogin);
router.post("/phone-verify", phoneLogin);
router.post("/google-verify-admin", googleVerifyAdmin);

export default router;
