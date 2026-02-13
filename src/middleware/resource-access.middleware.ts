import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db";
import { checkLessonAccess } from "../services/lesson.service";
import { UserRole } from "@/prisma/generated/prisma/client";

/**
 * Middleware to restrict access to lesson content (video, text, description, attachments)
 * Ensures the user has an active subscription or the lesson is free.
 */
export const requireLessonAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Fix: Cast param to string to avoid string[] type error
        const lessonId = (req.params.id || req.params.lessonId) as string;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!lessonId) {
            return res.status(400).json({
                success: false,
                message: "Lesson ID is required",
            });
        }

        // Admins have access to everything
        if (userRole === UserRole.admin) {
            return next();
        }

        // Check lesson access using existing service logic
        const { hasAccess, reason, lesson } = await checkLessonAccess(lessonId, userId);

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: reason || "Access denied. Subscription required.",
                code: "SUBSCRIPTION_REQUIRED",
                data: {
                    lessonId,
                    isFree: lesson?.isFree || false,
                }
            });
        }

        // Attach lesson to request for performance optimization if needed
        (req as any).lesson = lesson;
        next();
    } catch (error: any) {
        if (error.message === "Lesson not found") {
            return res.status(404).json({
                success: false,
                message: "Lesson not found",
            });
        }
        next(error);
    }
};
/**
 * Middleware to restrict direct access to Video objects
 * Ensures the video is either a public demo or the user has access to an associated lesson.
 */
export const requireVideoAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Fix: Cast param to string
        const videoId = (req.params.id || req.params.videoId) as string;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!videoId) return res.status(400).json({ success: false, message: "Video ID is required" });

        // Admins have access to everything
        if (userRole === UserRole.admin) return next();

        // 1. Fetch video with relations
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            include: {
                demoCourses: { select: { id: true } },
                videoLessons: {
                    select: {
                        lessonId: true,
                        lesson: { select: { isFree: true, courseId: true } }
                    }
                }
            }
        });

        if (!video) return res.status(404).json({ success: false, message: "Video not found" });

        // Fix: Cast to any to access relations if strict types are missing them
        const videoWithRelations = video as any;

        // 2. If it's a demo video for any course, it's public
        if (videoWithRelations.demoCourses && videoWithRelations.demoCourses.length > 0) return next();

        // 3. For lesson videos, check if user has access to at least ONE associated lesson
        const associatedLessons = videoWithRelations.videoLessons || [];

        // If any associated lesson is free, video is public
        if (associatedLessons.some((vl: any) => vl.lesson.isFree)) return next();

        // If no user, and video is not free/demo, deny
        if (!userId) return res.status(403).json({ success: false, message: "Authentication required", code: "AUTH_REQUIRED" });

        // Check entitlements for associated courses
        const courseIds = [...new Set(associatedLessons.map((vl: any) => vl.lesson.courseId))];

        const { hasAccess: checkEntitlement } = await import("../services/entitlement.service");

        for (const courseId of courseIds) {
            if (await checkEntitlement(userId, "COURSE", courseId as string)) {
                return next();
            }
        }

        return res.status(403).json({
            success: false,
            message: "Access denied. You do not have access to the course associated with this video.",
            code: "SUBSCRIPTION_REQUIRED"
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to restrict direct access to Attachment objects
 */
export const requireAttachmentAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Fix: Cast param to string
        const attachmentId = (req.params.id || req.params.attachmentId) as string;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!attachmentId) return res.status(400).json({ success: false, message: "Attachment ID is required" });

        // Admins have access to everything
        if (userRole === UserRole.admin) return next();

        // 1. Fetch attachment with associated lesson
        const attachment = await prisma.lessonAttachment.findUnique({
            where: { id: attachmentId },
            include: { lesson: { select: { id: true, isFree: true, courseId: true } } }
        });

        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // 2. If parent lesson is free, attachment is public
        if (attachment.lesson.isFree) return next();

        // 3. For paid lessons, check subscription
        if (!userId) return res.status(403).json({ success: false, message: "Authentication required", code: "AUTH_REQUIRED" });

        const { hasAccess: checkEntitlement } = await import("../services/entitlement.service");
        const hasAccess = await checkEntitlement(userId, "COURSE", attachment.lesson.courseId);

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You do not have access to the course associated with this attachment.",
                code: "SUBSCRIPTION_REQUIRED"
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};
