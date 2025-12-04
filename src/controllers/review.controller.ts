import { Request, Response, NextFunction } from "express";
import * as reviewService from "@/services/review.service";

/**
 * Create or update review (upsert pattern)
 * POST /api/courses/:courseId/reviews
 */
export const upsertReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;
    const { rating, review } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!rating) {
      return res.status(400).json({
        success: false,
        error: "Rating is required",
      });
    }

    const courseReview = await reviewService.upsertReview(courseId, userId, rating, review);

    return res.status(200).json({
      success: true,
      data: courseReview,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update existing review
 * PUT /api/courses/:courseId/reviews
 */
export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;
    const { rating, review } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const updatedReview = await reviewService.updateReview(courseId, userId, rating, review);

    return res.status(200).json({
      success: true,
      data: updatedReview,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete own review
 * DELETE /api/courses/:courseId/reviews
 */
export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const result = await reviewService.deleteReview(courseId, userId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * List reviews with pagination and optional auth
 * GET /api/courses/:courseId/reviews
 */
export const listReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id; // Optional
    const { page = "1", limit = "10", sortBy = "newest" } = req.query;

    const result = await reviewService.listReviews(courseId, {
      userId,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as "newest" | "oldest" | "highest" | "lowest",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get course rating statistics
 * GET /api/courses/:courseId/reviews/stats
 */
export const getCourseStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;

    const stats = await reviewService.getCourseStats(courseId);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Admin: Delete any review by ID
 * DELETE /api/reviews/:reviewId
 */
export const adminDeleteReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewId } = req.params;

    const result = await reviewService.adminDeleteReview(reviewId);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    next(error);
  }
};
