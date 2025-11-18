import express from "express";
import {
  createVideoHandler,
  getVideoHandler,
  getAllVideosHandler,
  updateVideoHandler,
  deleteVideoHandler,
  updateVideoStatusHandler,
  bulkDeleteVideosHandler,
} from "@/controllers/video.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Admin routes - all video operations require admin access
router.post("/", authenticate, requireAdmin, createVideoHandler);
router.get("/", authenticate, requireAdmin, getAllVideosHandler);
router.get("/:id", authenticate, requireAdmin, getVideoHandler);
router.put("/:id", authenticate, requireAdmin, updateVideoHandler);
router.patch("/:id/status", authenticate, requireAdmin, updateVideoStatusHandler);
router.delete("/:id", authenticate, requireAdmin, deleteVideoHandler);
router.delete("/bulk/delete", authenticate, requireAdmin, bulkDeleteVideosHandler);

export default router;
