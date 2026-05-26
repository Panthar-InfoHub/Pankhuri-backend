import express from "express";
import { cleanupExpiredHandler } from "@/controllers/scheduler.controller";

const router = express.Router();

/**
 * System-wide cleanup tasks triggered by Google Cloud Scheduler
 */
router.post("/cleanup", cleanupExpiredHandler);

export default router;
