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

const router = express.Router();

// Create video
router.post("/", createVideoHandler);

// Get all videos (with optional filters)
router.get("/", getAllVideosHandler);

// Get single video by ID
router.get("/:id", getVideoHandler);

// Update video by ID
router.put("/:id", updateVideoHandler);

// Update video status
router.patch("/:id/status", updateVideoStatusHandler);

// Delete single video by ID
router.delete("/:id", deleteVideoHandler);

// Bulk delete videos
router.delete("/bulk/delete", bulkDeleteVideosHandler);

export default router;
