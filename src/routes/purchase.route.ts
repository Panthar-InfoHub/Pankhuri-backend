import express from "express";
import {
    initiateCoursePurchaseHandler,
    verifyCoursePurchaseHandler
} from "@/controllers/purchase.controller";
import { authenticateWithSession } from "@/middleware/session.middleware";

const router = express.Router();

// All purchase routes require authentication
router.use(authenticateWithSession);

// Course purchases
router.post("/course", initiateCoursePurchaseHandler);
router.post("/course/verify", verifyCoursePurchaseHandler);

export default router;
