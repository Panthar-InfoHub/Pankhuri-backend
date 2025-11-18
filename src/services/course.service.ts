import { Prisma, CourseStatus, CourseLevel } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// Get all courses with filters
export const getAllCourses = async (filters?: {
  categoryId?: string;
  trainerId?: string;
  level?: CourseLevel;
  language?: string;
  status?: CourseStatus;
  search?: string;
  tags?: string[];
  sort?: "newest" | "popular" | "rating" | "title";
  page?: number;
  limit?: number;
}) => {
  const {
    categoryId,
    trainerId,
    level,
    language,
    status,
    search,
    tags,
    sort = "newest",
    page = 1,
    limit = 20,
  } = filters || {};

  const where: Prisma.CourseWhereInput = {
    ...(categoryId && { categoryId }),
    ...(trainerId && { trainerId }),
    ...(level && { level }),
    ...(language && { language }),
    ...(status && { status }),
    ...(tags &&
      tags.length > 0 && {
        tags: {
          hasSome: tags,
        },
      }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: "desc" };

  switch (sort) {
    case "popular":
      orderBy = { rating: "desc" };
      break;
    case "rating":
      orderBy = { rating: "desc" };
      break;
    case "title":
      orderBy = { title: "asc" };
      break;
  }

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        trainer: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    data: courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get course by ID
export const getCourseById = async (id: string, userId?: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      trainer: {
        select: {
          id: true,
          displayName: true,
          profileImage: true,
          email: true,
        },
      },
    },
  });

  return course;
};

// Get course by slug
export const getCourseBySlug = async (slug: string, userId?: string) => {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      category: true,
      trainer: {
        select: {
          id: true,
          displayName: true,
          profileImage: true,
        },
      },
    },
  });

  return course;
};

// Get related courses
export const getRelatedCourses = async (courseId: string, limit = 6) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { categoryId: true, level: true, tags: true },
  });

  if (!course) return [];

  const relatedCourses = await prisma.course.findMany({
    where: {
      id: { not: courseId },
      status: "active",
      OR: [
        { categoryId: course.categoryId },
        { level: course.level },
        {
          tags: {
            hasSome: course.tags,
          },
        },
      ],
    },
    include: {
      trainer: {
        select: {
          displayName: true,
          profileImage: true,
        },
      },
    },
    take: limit,
    orderBy: {
      rating: "desc",
    },
  });

  return relatedCourses;
};

// Get trending courses
export const getTrendingCourses = async (limit = 10) => {
  const courses = await prisma.course.findMany({
    where: {
      status: "active",
    },
    include: {
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      trainer: {
        select: {
          displayName: true,
          profileImage: true,
        },
      },
    },
    orderBy: { rating: "desc" },
    take: limit,
  });

  return courses;
};

// Create course (Admin/Trainer)
export const createCourse = async (data: Prisma.CourseCreateInput) => {
  // Check if slug already exists
  const existing = await prisma.course.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new Error("Course with this slug already exists");
  }

  const course = await prisma.course.create({
    data,
    include: {
      category: true,
      trainer: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  return course;
};

// Update course (Admin/Trainer)
export const updateCourse = async (
  id: string,
  trainerId: string,
  data: Prisma.CourseUpdateInput,
  isAdmin = false
) => {
  // Verify ownership if not admin
  if (!isAdmin) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: { trainerId: true },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    if (course.trainerId !== trainerId) {
      throw new Error("Unauthorized: You can only update your own courses");
    }
  }

  // If slug is being updated, check uniqueness
  if (data.slug && typeof data.slug === "string") {
    const existing = await prisma.course.findFirst({
      where: {
        slug: data.slug,
        NOT: { id },
      },
    });

    if (existing) {
      throw new Error("Course with this slug already exists");
    }
  }

  const course = await prisma.course.update({
    where: { id },
    data,
    include: {
      category: true,
      trainer: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return course;
};

// Delete course (Admin/Trainer)
export const deleteCourse = async (id: string, trainerId: string, isAdmin = false) => {
  // Verify ownership if not admin
  if (!isAdmin) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: { trainerId: true },
    });

    if (!course) {
      throw new Error("Course not found");
    }

    if (course.trainerId !== trainerId) {
      throw new Error("Unauthorized: You can only delete your own courses");
    }
  }

  await prisma.course.delete({
    where: { id },
  });

  return { message: "Course deleted successfully" };
};

// Publish/Unpublish course
export const togglePublish = async (
  id: string,
  trainerId: string,
  status: CourseStatus,
  isAdmin = false
) => {
  // Verify ownership if not admin
  if (!isAdmin) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: { trainerId: true },
    });

    if (!course || course.trainerId !== trainerId) {
      throw new Error("Unauthorized");
    }
  }

  const course = await prisma.course.update({
    where: { id },
    data: { status },
  });

  return course;
};

// Get courses by trainer
export const getCoursesByTrainer = async (trainerId: string, includeUnpublished = false) => {
  const where: Prisma.CourseWhereInput = {
    trainerId,
    ...(includeUnpublished ? {} : { status: "active" }),
  };

  const courses = await prisma.course.findMany({
    where,
    include: {
      category: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return courses;
};
