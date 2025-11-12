import express from "express";
import { googleLogin, phoneLogin } from "../controllers/auth.controller";

const router = express.Router();


router.post("/google-verify", googleLogin);
router.post("/phone-verify", phoneLogin);

export default router;
