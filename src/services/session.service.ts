import { Session } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";

/**
 * Create a new session for a user
 */
export const createSession = async (userId: string, expiresAt?: Date): Promise<Session> => {
    const session = await prisma.session.create({
        data: {
            userId,
            ...(expiresAt && { expiresAt }),
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
 * Delete a specific session
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
 * Delete all sessions for a user
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
 * Manage user sessions - ensure max 2 active sessions
 * If user has 2 or more active sessions, remove the oldest one(s)
 * Returns the newly created session
 */
export const manageUserSessions = async (userId: string): Promise<Session> => {
    const MAX_SESSIONS = 2;

    // Create new session
    const newSession = await createSession(userId);

    // Get all active sessions
    const activeSessions = await getActiveSessions(userId);

    // If user already has 2 or more active sessions, delete the oldest ones
    if (activeSessions.length >= MAX_SESSIONS) {
        // Sort by createdAt ascending (oldest first)
        const sessionsToDelete = activeSessions
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .slice(0, activeSessions.length - MAX_SESSIONS); // [s1, s2, s3] -> delete s1 if length=3 : slice (0,1)= [s1]

        const sessionIdsToDelete = sessionsToDelete.map((s) => s.id); // ["s1"]
        await deleteSessions(sessionIdsToDelete);
    }

    return newSession;
};

/**
 * Clean up all expired sessions (can be run as a cron job or mannual admin work)
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
