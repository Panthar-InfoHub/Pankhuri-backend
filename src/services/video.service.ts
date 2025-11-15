import { prisma } from "@/lib/db";

export interface CreateVideoDto {
  title: string;
  thumbnailUrl?: string;
  storageKey: string;
  playbackUrl?: string;
  status?: string;
  duration?: number;
  metadata?: any;
}

export interface UpdateVideoDto {
  title?: string;
  thumbnailUrl?: string;
  storageKey?: string;
  playbackUrl?: string;
  status?: string;
  duration?: number;
  metadata?: any;
}


export const createVideo = async (data: CreateVideoDto) => {
  try {
    const video = await prisma.video.create({
      data: {
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        storageKey: data.storageKey,
        playbackUrl: data.playbackUrl,
        status: data.status || "uploading",
        duration: data.duration,
        metadata: data.metadata,
      },
    });

    return video;
  } catch (error: any) {
    throw new Error(`Failed to create video: ${error.message}`);
  }
};

export const getVideoById = async (id: string) => {
  try {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    return video;
  } catch (error: any) {
    throw new Error(`Failed to fetch video: ${error.message}`);
  }
};


export const getAllVideos = async (filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  try {
    const where = filters?.status ? { status: filters.status } : {};

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
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }
};


export const updateVideo = async (id: string, data: UpdateVideoDto) => {
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
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.storageKey && { storageKey: data.storageKey }),
        ...(data.playbackUrl !== undefined && { playbackUrl: data.playbackUrl }),
        ...(data.status && { status: data.status }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
    });

    return video;
  } catch (error: any) {
    throw new Error(`Failed to update video: ${error.message}`);
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
    throw new Error(`Failed to delete video: ${error.message}`);
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
    throw new Error(`Failed to update video status: ${error.message}`);
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
    throw new Error(`Failed to bulk delete videos: ${error.message}`);
  }
};
