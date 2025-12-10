import { Request, Response, NextFunction } from "express";
import * as streakService from "../services/streak.service";

// ==================== STREAK ENDPOINTS ====================

/**
 * GET /api/streak
 * Get current user's streak statistics
 */
export const getCurrentUserStreak = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const statistics = await streakService.getStreakStatistics(req.user.id);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/streak/activity
 * Record user activity and update streak
 */
export const recordActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const { lessonCompleted, videoWatched, sessionCreated } = req.body;

    const updatedStreak = await streakService.updateUserStreak(req.user.id, {
      lessonCompleted,
      videoWatched,
      sessionCreated,
    });

    res.json({
      success: true,
      message: "Activity recorded successfully",
      data: updatedStreak,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/streak/leaderboard
 * Get streak leaderboard (current streaks)
 */
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = await streakService.getStreakLeaderboard(limit, offset);

    res.json({
      success: true,
      data: leaderboard,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/streak/leaderboard/all-time
 * Get all-time streak leaderboard (longest streaks)
 */
export const getAllTimeLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = await streakService.getLongestStreakLeaderboard(limit, offset);

    res.json({
      success: true,
      data: leaderboard,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/streak/rank
 * Get current user's streak rank
 */
export const getCurrentUserRank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const rank = await streakService.getUserStreakRank(req.user.id);

    res.json({
      success: true,
      data: {
        rank,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/streak/check-expiry
 * Check and update streak expiry for current user
 */
export const checkStreakExpiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const streak = await streakService.checkStreakExpiry(req.user.id);

    res.json({
      success: true,
      data: streak,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/streak/reset
 * Reset current user's streak
 */
export const resetStreak = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const streak = await streakService.resetUserStreak(req.user.id);

    res.json({
      success: true,
      message: "Streak reset successfully",
      data: streak,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/streak/admin/user/:userId
 * Get specific user's streak (admin only)
 */
export const getUserStreakById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const streak = await streakService.getUserStreak(userId);

    if (!streak) {
      return res.status(404).json({
        success: false,
        message: "Streak not found for this user",
      });
    }

    res.json({
      success: true,
      data: streak,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/streak/admin/bulk-check-expiry
 * Check streak expiry for all users (admin only, can be used with cron)
 */
export const bulkCheckExpiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await streakService.bulkCheckStreakExpiry();

    res.json({
      success: true,
      message: "Bulk streak expiry check completed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/streak/admin/reset/:userId
 * Reset specific user's streak (admin only)
 */
export const resetUserStreakById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const streak = await streakService.resetUserStreak(userId);

    res.json({
      success: true,
      message: "User streak reset successfully",
      data: streak,
    });
  } catch (error) {
    next(error);
  }
};
