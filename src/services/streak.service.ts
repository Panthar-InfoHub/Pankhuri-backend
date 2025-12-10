import { prisma } from "@/lib/db";
import { UserStreak } from "@/prisma/generated/prisma/client";

/**
 * Interface for activity data
 */
interface ActivityData {
  lessonCompleted?: boolean;
  videoWatched?: boolean;
  sessionCreated?: boolean;
}

/**
 * Get or create user streak record
 */
export const getOrCreateUserStreak = async (userId: string): Promise<UserStreak> => {
  let streak = await prisma.userStreak.findUnique({
    where: { userId },
  });

  if (!streak) {
    streak = await prisma.userStreak.create({
      data: {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
      },
    });
  }

  return streak;
};

/**
 * Get user streak by userId
 */
export const getUserStreak = async (userId: string): Promise<UserStreak | null> => {
  return await prisma.userStreak.findUnique({
    where: { userId },
  });
};

/**
 * Check if date is today (ignoring time)
 */
const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

/**
 * Check if date is yesterday (ignoring time)
 */
const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
};

/**
 * Calculate days between two dates
 */
const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const firstDate = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const secondDate = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));
};

/**
 * Update user streak based on activity
 * This is the main function to call when user performs an activity
 */
export const updateUserStreak = async (
  userId: string,
  activityData?: ActivityData
): Promise<UserStreak> => {
  const streak = await getOrCreateUserStreak(userId);
  const now = new Date();

  // If already active today, just return current streak
  if (streak.lastActivityDate && isToday(streak.lastActivityDate)) {
    return streak;
  }

  let newCurrentStreak = streak.currentStreak;
  let newLongestStreak = streak.longestStreak;
  let newTotalActiveDays = streak.totalActiveDays + 1;
  let streakStartDate = streak.streakStartDate;

  // Check if this continues the streak or breaks it
  if (streak.lastActivityDate) {
    if (isYesterday(streak.lastActivityDate)) {
      // Streak continues
      newCurrentStreak += 1;
    } else {
      // Streak broken - reset to 1
      newCurrentStreak = 1;
      streakStartDate = now;
    }
  } else {
    // First activity ever
    newCurrentStreak = 1;
    streakStartDate = now;
  }

  // Update longest streak if current exceeds it
  if (newCurrentStreak > newLongestStreak) {
    newLongestStreak = newCurrentStreak;
  }

  // Update the streak record
  const updatedStreak = await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: now,
      streakStartDate,
      totalActiveDays: newTotalActiveDays,
    },
  });

  return updatedStreak;
};

/**
 * Check and update streak (can be called daily via cron job)
 * This will reset streaks for users who haven't been active
 */
export const checkStreakExpiry = async (userId: string): Promise<UserStreak> => {
  const streak = await getOrCreateUserStreak(userId);

  if (!streak.lastActivityDate) {
    return streak;
  }

  const now = new Date();
  const daysSinceLastActivity = daysBetween(now, streak.lastActivityDate);

  // If more than 1 day has passed, reset the streak
  if (daysSinceLastActivity > 1 && streak.currentStreak > 0) {
    const updatedStreak = await prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: 0,
        streakStartDate: null,
      },
    });
    return updatedStreak;
  }

  return streak;
};

/**
 * Manually reset user streak
 */
export const resetUserStreak = async (userId: string): Promise<UserStreak> => {
  const streak = await getOrCreateUserStreak(userId);

  return await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: 0,
      streakStartDate: null,
    },
  });
};

/**
 * Get streak leaderboard (top users by current streak)
 */
export const getStreakLeaderboard = async (
  limit: number = 10,
  offset: number = 0
): Promise<
  Array<
    UserStreak & {
      user: {
        id: string;
        displayName: string | null;
        profileImage: string | null;
      };
    }
  >
> => {
  return await prisma.userStreak.findMany({
    where: {
      currentStreak: {
        gt: 0,
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
    orderBy: {
      currentStreak: "desc",
    },
    take: limit,
    skip: offset,
  });
};

/**
 * Get all-time streak leaderboard (by longest streak)
 */
export const getLongestStreakLeaderboard = async (
  limit: number = 10,
  offset: number = 0
): Promise<
  Array<
    UserStreak & {
      user: {
        id: string;
        displayName: string | null;
        profileImage: string | null;
      };
    }
  >
> => {
  return await prisma.userStreak.findMany({
    where: {
      longestStreak: {
        gt: 0,
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
    orderBy: {
      longestStreak: "desc",
    },
    take: limit,
    skip: offset,
  });
};

/**
 * Get user's streak rank
 */
export const getUserStreakRank = async (userId: string): Promise<number> => {
  const userStreak = await getUserStreak(userId);

  if (!userStreak || userStreak.currentStreak === 0) {
    return 0;
  }

  const rank = await prisma.userStreak.count({
    where: {
      currentStreak: {
        gt: userStreak.currentStreak,
      },
    },
  });

  return rank + 1;
};

/**
 * Get streak statistics
 */
export const getStreakStatistics = async (userId: string) => {
  const streak = await getUserStreak(userId);

  if (!streak) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      streakStartDate: null,
      lastActivityDate: null,
      isActiveToday: false,
      rank: 0,
    };
  }

  const isActiveToday = streak.lastActivityDate && isToday(streak.lastActivityDate);
  const rank = await getUserStreakRank(userId);

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    totalActiveDays: streak.totalActiveDays,
    streakStartDate: streak.streakStartDate,
    lastActivityDate: streak.lastActivityDate,
    isActiveToday,
    rank,
  };
};

/**
 * Bulk check streak expiry for all users (for cron job)
 */
export const bulkCheckStreakExpiry = async (): Promise<{
  checked: number;
  expired: number;
}> => {
  const allStreaks = await prisma.userStreak.findMany({
    where: {
      currentStreak: {
        gt: 0,
      },
      lastActivityDate: {
        not: null,
      },
    },
  });

  const now = new Date();
  let expiredCount = 0;

  for (const streak of allStreaks) {
    if (streak.lastActivityDate) {
      const daysSinceLastActivity = daysBetween(now, streak.lastActivityDate);

      if (daysSinceLastActivity > 1) {
        await prisma.userStreak.update({
          where: { userId: streak.userId },
          data: {
            currentStreak: 0,
            streakStartDate: null,
          },
        });
        expiredCount++;
      }
    }
  }

  return {
    checked: allStreaks.length,
    expired: expiredCount,
  };
};
