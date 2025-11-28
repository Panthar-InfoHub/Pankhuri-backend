import { prisma } from "@/lib/db";
import { Prisma } from "@/prisma/generated/prisma/client";

// ==================== CREATE & UPDATE REVIEWS ====================

// Create or update review (upsert pattern)
export const upsertReview = async (
  courseId: string,
  userId: string,
  rating: number,
  review?: string
) => {
  // Validate rating
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  // Validate review length
  if (review && review.length > 1000) {
    throw new Error("Review must be 1000 characters or less");
  }

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  // Check if review already exists
  const existingReview = await prisma.courseReview.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
  });

  let courseReview;

  if (existingReview) {
    // Update existing review
    courseReview = await prisma.courseReview.update({
      where: { id: existingReview.id },
      data: {
        rating,
        review: review?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
    });
  } else {
    // Create new review
    courseReview = await prisma.courseReview.create({
      data: {
        courseId,
        userId,
        rating,
        review: review?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // Recalculate course rating statistics
  await recalculateCourseRating(courseId);

  return courseReview;
};

// ==================== UPDATE & DELETE REVIEWS ====================

// Update own review
export const updateReview = async (
  courseId: string,
  userId: string,
  rating?: number,
  review?: string
) => {
  // Validate rating if provided
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  // Validate review length if provided
  if (review !== undefined && review.length > 1000) {
    throw new Error("Review must be 1000 characters or less");
  }

  // Find existing review
  const existingReview = await prisma.courseReview.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
  });

  if (!existingReview) {
    throw new Error("Review not found. Please create a review first.");
  }

  // Update review
  const updatedReview = await prisma.courseReview.update({
    where: { id: existingReview.id },
    data: {
      ...(rating !== undefined && { rating }),
      ...(review !== undefined && { review: review.trim() || null }),
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          profileImage: true,
        },
      },
    },
  });

  // Recalculate course rating statistics
  await recalculateCourseRating(courseId);

  return updatedReview;
};

// ==================== DELETE REVIEWS ====================

// Delete own review
export const deleteReview = async (courseId: string, userId: string) => {
  // Find existing review
  const existingReview = await prisma.courseReview.findUnique({
    where: {
      courseId_userId: {
        courseId,
        userId,
      },
    },
  });

  if (!existingReview) {
    throw new Error("Review not found");
  }

  // Delete review
  await prisma.courseReview.delete({
    where: { id: existingReview.id },
  });

  // Recalculate course rating statistics
  await recalculateCourseRating(courseId);

  return { message: "Review deleted successfully" };
};

// ==================== LIST & STATS ====================

// List reviews with pagination and stats
export const listReviews = async (
  courseId: string,
  filters?: {
    userId?: string;
    page?: number;
    limit?: number;
    sortBy?: "newest" | "oldest" | "highest" | "lowest";
  }
) => {
  const { userId, page = 1, limit = 10, sortBy = "newest" } = filters || {};

  // Validate pagination
  const validPage = Math.max(1, page);
  const validLimit = Math.min(50, Math.max(1, limit)); // Cap at 50
  const skip = (validPage - 1) * validLimit;

  // Determine sort order
  let orderBy: Prisma.CourseReviewOrderByWithRelationInput = { createdAt: "desc" };

  switch (sortBy) {
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "highest":
      orderBy = { rating: "desc" };
      break;
    case "lowest":
      orderBy = { rating: "asc" };
      break;
  }

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      averageRating: true,
      totalReviews: true,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  let myReview = null;

  // If user is authenticated, get their review separately
  if (userId) {
    myReview = await prisma.courseReview.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
    });
  }

  // Build where clause for main query (exclude user's review if exists)
  const where: Prisma.CourseReviewWhereInput = {
    courseId,
    ...(userId && myReview && { userId: { not: userId } }),
  };

  // Get reviews and total count
  const [reviews, totalCount] = await Promise.all([
    prisma.courseReview.findMany({
      where,
      orderBy,
      skip,
      take: validLimit,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
    }),
    prisma.courseReview.count({ where }),
  ]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / validLimit);
  const hasNext = validPage < totalPages;
  const hasPrev = validPage > 1;

  // Get rating distribution
  const ratingDistribution = await getRatingDistribution(courseId);

  // Format reviews
  const formattedReviews = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    review: r.review,
    user: r.user,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isMyReview: false,
  }));

  // Format user's own review if exists
  let formattedMyReview = null;
  if (myReview) {
    formattedMyReview = {
      id: myReview.id,
      rating: myReview.rating,
      review: myReview.review,
      createdAt: myReview.createdAt,
      updatedAt: myReview.updatedAt,
      canEdit: true,
      canDelete: true,
    };
  }

  return {
    myReview: formattedMyReview,
    reviews: formattedReviews,
    pagination: {
      page: validPage,
      limit: validLimit,
      total: totalCount,
      totalPages,
      hasNext,
      hasPrev,
    },
    stats: {
      averageRating: course.averageRating,
      totalReviews: course.totalReviews,
      ratingDistribution,
    },
  };
};

// Get course rating stats
export const getCourseStats = async (courseId: string) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      averageRating: true,
      totalReviews: true,
    },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const ratingDistribution = await getRatingDistribution(courseId);

  return {
    averageRating: course.averageRating,
    totalReviews: course.totalReviews,
    ratingDistribution,
  };
};

// ==================== HELPER FUNCTIONS ====================

// Helper: Recalculate course rating and total reviews
const recalculateCourseRating = async (courseId: string) => {
  const stats = await prisma.courseReview.aggregate({
    where: { courseId },
    _avg: {
      rating: true,
    },
    _count: {
      id: true,
    },
  });

  const averageRating = stats._avg.rating || 0;
  const totalReviews = stats._count.id || 0;

  await prisma.course.update({
    where: { id: courseId },
    data: {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews,
    },
  });
};

// Helper: Get rating distribution
const getRatingDistribution = async (courseId: string) => {
  const distribution = await prisma.courseReview.groupBy({
    by: ["rating"],
    where: { courseId },
    _count: {
      rating: true,
    },
  });

  const result: Record<number, number> = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  distribution.forEach((item) => {
    result[item.rating] = item._count.rating;
  });

  return result;
};

// ==================== ADMIN OPERATIONS ====================

// Admin: Delete any review
export const adminDeleteReview = async (reviewId: string) => {
  const review = await prisma.courseReview.findUnique({
    where: { id: reviewId },
    select: { courseId: true },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  await prisma.courseReview.delete({
    where: { id: reviewId },
  });

  // Recalculate course rating
  await recalculateCourseRating(review.courseId);

  return { message: "Review deleted successfully" };
};
