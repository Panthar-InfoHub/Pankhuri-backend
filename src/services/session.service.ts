import { Session } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

/**
 * Create a new session for a user
 */
export const createSession = async (
  userId: string,
  expiresAt?: Date,
  fcmToken?: string
): Promise<Session> => {
  const session = await prisma.session.create({
    data: {
      userId,
      ...(expiresAt && { expiresAt }),
      ...(fcmToken && { fcmToken }),
    },
  });

  return session;
};

/**
 * Get session by ID
 */
export const getSessionById = async (sessionId: string): Promise<Session | null> => {
  return await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
    },
  });
};

/**
 * Get all active (non-expired) sessions for a user
 */
export const getActiveSessions = async (userId: string): Promise<Session[]> => {
  return await prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(), // Greater than current time = not expired
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Get all sessions for a user (including expired)
 */
export const getAllUserSessions = async (userId: string): Promise<Session[]> => {
  return await prisma.session.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });
};

/**
 * Delete a specific session (FCM token cleanup automatic via session deletion)
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  await prisma.session.delete({
    where: { id: sessionId },
  });
};

/**
 * Delete multiple sessions by IDs
 */
export const deleteSessions = async (sessionIds: string[]): Promise<void> => {
  await prisma.session.deleteMany({
    where: {
      id: {
        in: sessionIds,
      },
    },
  });
};

/**
 * Delete all sessions for a user (FCM tokens deleted automatically with sessions)
 */
export const deleteAllUserSessions = async (userId: string): Promise<void> => {
  await prisma.session.deleteMany({
    where: { userId },
  });
};

/**
 * Delete expired sessions for a user
 */
export const deleteExpiredSessions = async (userId: string): Promise<void> => {
  await prisma.session.deleteMany({
    where: {
      userId,
      expiresAt: {
        lte: new Date(), // Less than or equal to current time = expired
      },
    },
  });
};

/**
 * Validate session exists and is not expired
 */
export const validateSession = async (sessionId: string): Promise<Session | null> => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    return null;
  }

  return session;
};

/**
 * Update session expiry
 */
export const updateSessionExpiry = async (sessionId: string, expiresAt: Date): Promise<Session> => {
  return await prisma.session.update({
    where: { id: sessionId },
    data: { expiresAt },
  });
};

/**
 * Update session FCM token
 */
export const updateSessionFcmToken = async (
  sessionId: string,
  fcmToken: string
): Promise<Session> => {
  return await prisma.session.update({
    where: { id: sessionId },
    data: { fcmToken },
  });
};

/**
 * Manage user sessions - ensure max 2 active sessions
 * If user has 2 or more active sessions, remove the oldest one(s)
 * Uses transaction to ensure atomicity
 * Returns the newly created session
 */
export const manageUserSessions = async (userId: string, fcmToken?: string): Promise<Session> => {
  return await prisma.$transaction(async (tx) => {
    const MAX_SESSIONS = 2;

    // Get all active sessions BEFORE creating new one
    const activeSessions = await tx.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    // If user already has 2 or more active sessions, delete the oldest ones to make room
    if (activeSessions.length >= MAX_SESSIONS) {
      const sessionsToDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      const sessionIdsToDelete = sessionsToDelete.map((s) => s.id);

      // Delete old sessions (FCM tokens deleted automatically)
      await tx.session.deleteMany({
        where: { id: { in: sessionIdsToDelete } },
      });
    }

    // Create new session with FCM token
    return await tx.session.create({
      data: {
        userId,
        ...(fcmToken && { fcmToken }),
      },
    });
  });
};

/**
 * Clean up all expired sessions (FCM tokens deleted automatically)
 * Can be run as a cron job or manual admin work
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  return result.count;
};
