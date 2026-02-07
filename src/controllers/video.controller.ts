import { deleteFolder, deleteFromDO, extractKeyFromUrl, extractTranscodeVideoFolderUrl } from "@/lib/cloud";
import { VideoDescription } from "@/lib/types";
import {
  bulkDeleteVideos,
  createVideo,
  deleteVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  updateVideoStatus,
} from "@/services/video.service";
import { NextFunction, Request, Response } from "express";
import { z } from "zod";

/**
 * Create a new video
 * POST /api/videos
 */

/**
 * Zod Schema for videoDescription field validation
 * 
 * NOTE: The videoDescription field in the Video model is stored as Json type in the database,
 * which provides flexibility but no runtime type safety or structure validation. We explicitly
 * use Zod parsing here to enforce a consistent structure and validate the data before storing.
 * 
 * Expected Structure:
 * {
 *   disclaimer?: string,              // Optional disclaimer text for the video
 *   timestamps?: Array<{               // Optional array of video chapter/section timestamps
 *     time_interval: string,           // Format: "MM:SS" (e.g., "05:30")
 *     time_content: string             // Description of what happens at this timestamp
 *   }>,
 *   description?: string               // Optional detailed description of the video
 * }
 * 
 * This schema ensures data consistency and helps future developers understand
 * the expected structure when working with videoDescription field.
 */
const VideoDescriptionSchema = z.object({
  disclaimer: z.string().optional(),

  products: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string(),
      image: z.string(),
    })
  ).optional(),

  timestamps: z
    .array(
      z.object({
        time_interval: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
        time_content: z.string().min(1),
      })
    )
    .optional(),

  description: z.string().optional(),
})

export const createVideoHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, thumbnailUrl, storageKey, playbackUrl, status, duration, metadata, quality, videoDescription } = req.body;

    // Validation
    if (!title || !storageKey) {
      return res.status(400).json({
        success: false,
        error: "Title and storageKey are required",
      });
    }

    let parsedVideoDescription: VideoDescription | undefined;

    if (videoDescription) {
      const result = VideoDescriptionSchema.safeParse(videoDescription);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid videoDescription format",
          details: result.error.flatten(),
        });
      }

      parsedVideoDescription = result.data;
    }

    const video = await createVideo({
      title,
      thumbnailUrl,
      storageKey,
      playbackUrl,
      status,
      duration,
      metadata,
      videoDescription: parsedVideoDescription,
    }, parseInt(quality) || 1080);

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
    const { status, limit, offset, search } = req.query;

    const filters = {
      status: status as string | undefined,
      search: search as string | undefined,
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

    // Delete video thumbnail, storageKey (original video), playback url (transcoded video) from Digital Ocean Spaces
    const deleteKeys: { thumbnail_url?: string, storage_key?: string, playback_url?: string } = {};

    if (video.thumbnailUrl) {
      deleteKeys["thumbnail_url"] = extractKeyFromUrl(video.thumbnailUrl);
    }

    deleteKeys["storage_key"] = video.storageKey;

    if (video.playbackUrl) {
      deleteKeys["playback_url"] = extractTranscodeVideoFolderUrl(video.playbackUrl);
    }

    // [extractKeyFromUrl(video.thumbnailUrl!), video.storageKey, video.playbackUrl].filter((key): key is string => !!key);
    console.log("Delete keys ==> ", deleteKeys)

    await Promise.all([
      deleteFromDO(deleteKeys.thumbnail_url!),
      deleteFromDO(deleteKeys.storage_key!),
      deleteFolder(deleteKeys.playback_url!)
    ]);


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


export const transcodeCompleteHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { video_id, playbackUrl, status } = req.body;


    const result = await updateVideo(video_id, { playbackUrl, status });

    return res.status(200).json({
      success: true,
      message: "Video updated successfully",
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};