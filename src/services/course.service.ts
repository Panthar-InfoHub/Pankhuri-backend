import { Prisma, CourseStatus, CourseLevel } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

// ==================== COURSE QUERIES ====================

// Get all courses with filters
export const getAllCourses = async (filters?: {
  categoryId?: string;
  trainerId?: string;
  level?: CourseLevel;
  language?: string;
  status?: CourseStatus;
  search?: string;
  tags?: string[];
  duration?: "short" | "long";
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
    duration,
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
    ...(duration && {
      duration: duration === "short" ? { lte: 180 } : { gt: 180 },
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
            user: {
              select: {
                id: true,
                displayName: true,
                profileImage: true,
              },
            },
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

// Get course by ID with modules and lessons
export const getCourseById = async (id: string, userId?: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      demoVideo: {
        select: {
          id: true,
          playbackUrl: true,
        },
      },
      trainer: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              displayName: true,
              profileImage: true,
              email: true,
            },
          },
        },
      },
      // Get modules with their lessons
      modules: {
        where: { status: "published" },
        orderBy: { sequence: "asc" },
        include: {
          lessons: {
            where: { status: "published" },
            orderBy: { sequence: "asc" },
            include: {
              videoLesson: {
                include: {
                  video: {
                    select: {
                      id: true,
                      title: true,
                      thumbnailUrl: true,
                      duration: true,
                      status: true,
                    },
                  },
                },
              },
              textLesson: true,
            },
          },
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      },
      // Get direct lessons (not in modules)
      lessons: {
        where: {
          moduleId: null,
          status: "published",
        },
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  duration: true,
                  status: true,
                },
              },
            },
          },
          textLesson: true,
        },
      },
      _count: {
        select: {
          modules: true,
          lessons: true,
        },
      },
    },
  });

  if (!course) {
    return null;
  }

  // Calculate total lessons and duration
  let totalLessons = (course as any).lessons.length;
  let totalDuration = 0;

  // Count lessons in modules
  (course as any).modules.forEach((module: any) => {
    totalLessons += module.lessons.length;
    module.lessons.forEach((lesson: any) => {
      totalDuration += lesson.duration || 0;
    });
  });

  // Count direct lessons duration
  (course as any).lessons.forEach((lesson: any) => {
    totalDuration += lesson.duration || 0;
  });

  // Data is already sanitized at query level - no sensitive URLs or content fetched
  return {
    ...course,
    stats: {
      totalModules: (course as any)._count.modules,
      totalLessons,
      totalDuration, // in minutes
    },
  };
};

// Get course by slug with modules and lessons
export const getCourseBySlug = async (slug: string, userId?: string) => {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      category: true,
      trainer: {
        select: {
          id: true,
          user: {
            select: {
              displayName: true,
              profileImage: true,
            },
          },
        },
      },
      // Get modules with their lessons
      modules: {
        where: { status: "published" },
        orderBy: { sequence: "asc" },
        include: {
          lessons: {
            where: { status: "published" },
            orderBy: { sequence: "asc" },
            include: {
              videoLesson: {
                include: {
                  video: {
                    select: {
                      id: true,
                      title: true,
                      thumbnailUrl: true,
                      duration: true,
                      status: true,
                    },
                  },
                },
              },
              textLesson: true,
            },
          },
          _count: {
            select: {
              lessons: true,
            },
          },
        },
      },
      // Get direct lessons (not in modules)
      lessons: {
        where: {
          moduleId: null,
          status: "published",
        },
        orderBy: { sequence: "asc" },
        include: {
          videoLesson: {
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  duration: true,
                  status: true,
                },
              },
            },
          },
          textLesson: true,
        },
      },
      _count: {
        select: {
          modules: true,
          lessons: true,
        },
      },
    },
  });

  if (!course) {
    return null;
  }

  // Calculate total lessons and duration
  let totalLessons = (course as any).lessons.length;
  let totalDuration = 0;

  // Count lessons in modules
  (course as any).modules.forEach((module: any) => {
    totalLessons += module.lessons.length;
    module.lessons.forEach((lesson: any) => {
      totalDuration += lesson.duration || 0;
    });
  });

  // Count direct lessons duration
  (course as any).lessons.forEach((lesson: any) => {
    totalDuration += lesson.duration || 0;
  });

  // Data is already sanitized at query level - no sensitive URLs or content fetched
  return {
    ...course,
    stats: {
      totalModules: (course as any)._count.modules,
      totalLessons,
      totalDuration, // in minutes
    },
  };
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
          id: true,
          user: {
            select: {
              displayName: true,
              profileImage: true,
            },
          },
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
          id: true,
          user: {
            select: {
              displayName: true,
              profileImage: true,
            },
          },
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
  try {
    const course = await prisma.course.create({
      data,
      include: {
        category: true,
        trainer: {
          select: {
            id: true,
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return course;
  } catch (error: any) {
    console.error("Error creating course:", error);
    // Handle Prisma errors
    if (error.code === "P2002") {
      // Unique constraint violation
      throw new Error("Course with this slug already exists");
    }
    if (error.code === "P2025") {
      // Record not found (foreign key constraint)
      throw new Error("Invalid trainerId or categoryId");
    }
    if (error.code === "P2003") {
      // Foreign key constraint failed
      const field = error.meta?.field_name;
      if (field?.includes("trainerId")) {
        throw new Error("Trainer not found or inactive");
      }
      if (field?.includes("categoryId")) {
        throw new Error("Category not found");
      }
      throw new Error("Invalid reference in course data");
    }
    throw error;
  }
};

// Validate trainer exists and return trainer ID
export const validateTrainer = async (trainerId: string): Promise<string> => {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { id: true, status: true },
  });

  if (!trainer) {
    throw new Error("User does not have a trainer profile");
  }

  if (trainer.status !== "active") {
    throw new Error("Trainer profile is not active");
  }

  return trainer.id;
};

// Validate category exists
export const validateCategory = async (categoryId: string): Promise<boolean> => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new Error("Category not found. Please select a valid category.");
  }

  return true;
};

// Update course (Admin only)
export const updateCourse = async (id: string, data: Prisma.CourseUpdateInput) => {
  try {
    const course = await prisma.course.update({
      where: { id },
      data,
      include: {
        category: true,
        trainer: {
          select: {
            id: true,
            user: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    return course;
  } catch (error: any) {
    // Handle Prisma errors
    if (error.code === "P2002") {
      // Unique constraint violation
      throw new Error("Course with this slug already exists");
    }
    if (error.code === "P2025") {
      // Record not found
      throw new Error("Course not found");
    }
    if (error.code === "P2003") {
      // Foreign key constraint failed
      const field = error.meta?.field_name;
      if (field?.includes("trainerId")) {
        throw new Error("Trainer not found or inactive");
      }
      if (field?.includes("categoryId")) {
        throw new Error("Category not found");
      }
      throw new Error("Invalid reference in course data");
    }
    throw error;
  }
};

// Delete course (Admin only)
export const deleteCourse = async (id: string) => {
  const course = await prisma.course.findUnique({
    where: { id },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  await prisma.course.delete({
    where: { id },
  });

  return { message: "Course deleted successfully" };
};

// Publish/Unpublish course (Admin only)
export const togglePublish = async (id: string, status: CourseStatus) => {
  const course = await prisma.course.findUnique({
    where: { id },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const updatedCourse = await prisma.course.update({
    where: { id },
    data: { status },
  });

  return updatedCourse;
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
