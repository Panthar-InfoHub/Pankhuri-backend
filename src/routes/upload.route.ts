import { Router } from "express";
import { getPresignedUrlHandler } from "@/controllers/upload.controller";
import { authenticateWithSession } from "@/middleware/session.middleware";

const router = Router();

// Route to get a presigned URL for image uploads
// Only authenticated users can request a presigned URL
router.post("/presigned-url", authenticateWithSession, getPresignedUrlHandler);

export default router;
