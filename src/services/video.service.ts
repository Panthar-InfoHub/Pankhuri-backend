import { prisma } from "@/lib/db";
import { publishMessage } from "@/lib/pub_sub";
import { Prisma } from "@/prisma/generated/prisma/client";

export const createVideo = async (data: Prisma.VideoCreateInput, quality: number) => {
  try {
    const isExternal = !!data.externalUrl;
    const video = await prisma.video.create({
      data: {
        title: data.title,
        externalUrl: data.externalUrl,
        thumbnailUrl: data.thumbnailUrl,
        storageKey: data.storageKey,
        playbackUrl: data.playbackUrl,
        status: isExternal ? "ready" : (data.status || "uploading"),
        duration: data.duration,
        metadata: data.metadata,
        videoDescription: data.videoDescription
      },
    });

    if (video.storageKey) {
      console.debug("\nPublishing video processing message to Pub/Sub...");
      const { success, messageId, error } = await publishMessage(video.storageKey, quality, video.id);

      // if (!success) {
      //   console.error(`Failed to publish video processing message: ${error}`);
      //   throw new Error("Failed to initiate video processing. Please try again.");
      // }
    }


    return { video };
  } catch (error: any) {
    console.error("Video creation error:", error);
    throw new Error("Failed to create video. Please try again.");
  }
};



export const getVideoById = async (id: string) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id },
    });
    let streamUrl = ""
    if (video?.playbackUrl) {
      streamUrl = `${process.env.BACKEND_URL}/api/stream${video.playbackUrl}`;
    } else if (video?.externalUrl) {
      streamUrl = video.externalUrl;
    }



    return { video, streamUrl };
  } catch (error: any) {
    console.error("Get video error:", error);
    throw new Error("Failed to fetch video. Please try again.");
  }
};



export const getAllVideos = async (filters?: {
  status?: string;
  limit?: number;
  offset?: number;
  search?: string;
}) => {

  const { search } = filters || {}
  try {
    const where = filters?.status ? {
      status: filters.status,
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
        ],
      }),
    } : {};

    const videos = await prisma.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    const total = await prisma.video.count({ where });

    return {
      videos,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    };
  } catch (error: any) {
    console.error("Get videos error:", error);
    throw new Error("Failed to fetch videos. Please try again.");
  }
};

export const updateVideo = async (id: string, data: Prisma.VideoUpdateInput) => {
  try {
    // Check if video exists
    const existingVideo = await prisma.video.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      throw new Error("Video not found");
    }

    const video = await prisma.video.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.externalUrl !== undefined && { externalUrl: data.externalUrl }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.storageKey !== undefined && { storageKey: data.storageKey }),
        ...(data.playbackUrl !== undefined && { playbackUrl: data.playbackUrl }),
        ...(data.status && { status: data.status }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.videoDescription !== undefined && { videoDescription: data.videoDescription }),
      },
    });



    return video;
  } catch (error: any) {
    console.error("Update video error:", error);
    // Re-throw if it's a custom error message
    if (error.message === "Video not found") {
      throw error;
    }
    throw new Error("Failed to update video. Please try again.");
  }
};

export const deleteVideo = async (id: string) => {
  try {
    // Check if video exists
    const existingVideo = await prisma.video.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      throw new Error("Video not found");
    }

    const video = await prisma.video.delete({
      where: { id },
    });

    return video;
  } catch (error: any) {
    console.error("Delete video error:", error);
    // Re-throw if it's a custom error message
    if (error.message === "Video not found") {
      throw error;
    }
    throw new Error("Failed to delete video. Please try again.");
  }
};

export const updateVideoStatus = async (id: string, status: string) => {
  try {
    const video = await prisma.video.update({
      where: { id },
      data: { status },
    });

    return video;
  } catch (error: any) {
    console.error("Update video status error:", error);
    throw new Error("Failed to update video status. Please try again.");
  }
};

export const bulkDeleteVideos = async (ids: string[]) => {
  try {
    const result = await prisma.video.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return result;
  } catch (error: any) {
    console.error("Bulk delete videos error:", error);
    throw new Error("Failed to delete videos. Please try again.");
  }
};
