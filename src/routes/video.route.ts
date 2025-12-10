import express from "express";
import {
  createVideoHandler,
  getVideoHandler,
  getAllVideosHandler,
  updateVideoHandler,
  deleteVideoHandler,
  updateVideoStatusHandler,
  bulkDeleteVideosHandler,
  transcodeCompleteHandler,
} from "@/controllers/video.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = express.Router();

// Admin routes - all video operations require admin access
router.post("/", authenticateWithSession, requireAdmin, createVideoHandler);
router.get("/", authenticateWithSession, requireAdmin, getAllVideosHandler);
router.get("/:id", authenticateWithSession, getVideoHandler);
router.put("/:id", authenticateWithSession, requireAdmin, updateVideoHandler);
router.patch("/:id/status", authenticateWithSession, requireAdmin, updateVideoStatusHandler);
router.delete("/:id", authenticateWithSession, requireAdmin, deleteVideoHandler);
router.delete("/bulk/delete", authenticateWithSession, requireAdmin, bulkDeleteVideosHandler);

// Bulk delete videos
router.post("/transcode-complete", transcodeCompleteHandler);
export default router;
