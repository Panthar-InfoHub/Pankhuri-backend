import { NextFunction, Request, Response } from "express";
import {
  createVideo,
  getVideoById,
  getAllVideos,
  updateVideo,
  deleteVideo,
  updateVideoStatus,
  bulkDeleteVideos,
} from "@/services/video.service";

/**
 * Create a new video
 * POST /api/videos
 */
export const createVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, thumbnailUrl, storageKey, playbackUrl, status, duration, metadata } = req.body;

    // Validation
    if (!title || !storageKey) {
      return res.status(400).json({
        success: false,
        error: "Title and storageKey are required",
      });
    }

    const video = await createVideo({
      title,
      thumbnailUrl,
      storageKey,
      playbackUrl,
      status,
      duration,
      metadata,
    });

    return res.status(201).json({
      success: true,
      message: "Video created successfully",
      data: video,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get video by ID
 * GET /api/videos/:id
 */
export const getVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const video = await getVideoById(id);

    if (!video) {
      return res.status(404).json({
        success: false,
        error: "Video not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all videos
 * GET /api/videos
 */
export const getAllVideosHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit, offset } = req.query;

    const filters = {
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const result = await getAllVideos(filters);

    return res.status(200).json({
      success: true,
      data: result.videos,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.videos.length < result.total,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update video
 * PUT /api/videos/:id
 */
export const updateVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, thumbnailUrl, storageKey, playbackUrl, status, duration, metadata } = req.body;

    const video = await updateVideo(id, {
      title,
      thumbnailUrl,
      storageKey,
      playbackUrl,
      status,
      duration,
      metadata,
    });

    return res.status(200).json({
      success: true,
      message: "Video updated successfully",
      data: video,
    });
  } catch (error: any) {
    console.error("Update video error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    next(error);
  }
};

/**
 * Delete video
 * DELETE /api/videos/:id
 */
export const deleteVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const video = await deleteVideo(id);

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
      data: video,
    });
  } catch (error: any) {
    console.error("Delete video error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    next(error);
  }
};

/**
 * Update video status
 * PATCH /api/videos/:id/status
 */
export const updateVideoStatusHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const video = await updateVideoStatus(id, status);

    return res.status(200).json({
      success: true,
      message: "Video status updated successfully",
      data: video,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Bulk delete videos
 * DELETE /api/videos/bulk
 */
export const bulkDeleteVideosHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "ids array is required",
      });
    }

    const result = await bulkDeleteVideos(ids);

    return res.status(200).json({
      success: true,
      message: `${result.count} video(s) deleted successfully`,
      data: { deletedCount: result.count },
    });
  } catch (error: any) {
    next(error);
  }
};
