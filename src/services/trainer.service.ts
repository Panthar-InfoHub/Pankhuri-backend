import { Prisma, TrainerStatus } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// ==================== TRAINER OPERATIONS ====================

// Get all trainers
export const getAllTrainers = async (filters?: {
  status?: TrainerStatus;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, search, page = 1, limit = 50 } = filters || {};

  const where: Prisma.TrainerWhereInput = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { user: { displayName: { contains: search, mode: "insensitive" } } },
        { bio: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [trainers, total] = await Promise.all([
    prisma.trainer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            profileImage: true,
            status: true,
            _count: {
              select: {
                trainedCourses: true,
              },
            },
          },
        },
      },
      orderBy: {
        rating: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.trainer.count({ where }),
  ]);

  return {
    data: trainers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get trainer by ID
export const getTrainerById = async (id: string) => {
  const trainer = await prisma.trainer.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          trainedCourses: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailImage: true,
              rating: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return trainer;
};

// Get trainer by user ID
export const getTrainerByUserId = async (userId: string) => {
  const trainer = await prisma.trainer.findUnique({
    where: { userId },
    include: {
      user: true,
    },
  });

  return trainer;
};

// Create trainer profile
export const createTrainerProfile = async (data: {
  userId: string;
  bio?: string;
  specialization?: string[];
  experience?: number;
  socialLinks?: any;
}) => {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Check if trainer profile already exists
  const existing = await prisma.trainer.findUnique({
    where: { userId: data.userId },
  });
  if (existing) {
    throw new Error("Trainer profile already exists for this user");
  }

  // Create trainer profile
  const trainer = await prisma.trainer.create({
    data: {
      userId: data.userId,
      bio: data.bio,
      specialization: data.specialization || [],
      experience: data.experience,
      socialLinks: data.socialLinks,
    },
    include: {
      user: true,
    },
  });

  return trainer;
};

// Update trainer profile
export const updateTrainerProfile = async (
  id: string,
  data: {
    bio?: string;
    specialization?: string[];
    experience?: number;
    socialLinks?: any;
    status?: TrainerStatus;
  }
) => {
  return await prisma.trainer.update({
    where: { id },
    data,
    include: {
      user: true,
    },
  });
};

// Delete trainer profile
export const deleteTrainerProfile = async (id: string) => {
  // Check if trainer has courses
  const trainer = await prisma.trainer.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          _count: {
            select: {
              trainedCourses: true,
            },
          },
        },
      },
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found");
  }

  if (trainer.user._count.trainedCourses > 0) {
    throw new Error("Cannot delete trainer profile with associated courses");
  }

  await prisma.trainer.delete({
    where: { id },
  });

  return { message: "Trainer profile deleted successfully" };
};
