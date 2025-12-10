import { Request, Response, NextFunction } from "express";
import * as courseService from "../services/course.service";
import { CourseLevel, CourseStatus } from "@/prisma/generated/prisma/client";

// GET /api/courses - Get all courses with filters
export const getAllCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      categoryId,
      trainerId,
      level,
      language,
      status,
      search,
      tags,
      duration,
      sort,
      page,
      limit,
    } = req.query;

    const result = await courseService.getAllCourses({
      categoryId: categoryId as string | undefined,
      trainerId: trainerId as string | undefined,
      level: level as CourseLevel | undefined,
      language: language as string | undefined,
      status: status as CourseStatus | undefined,
      search: search as string | undefined,
      tags: tags ? (tags as string).split(",") : undefined,
      duration: duration as "short" | "long" | undefined,
      sort: sort as any,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/:id - Get course by ID
export const getCourseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Optional: pass userId as query param

    const course = await courseService.getCourseById(id, userId as string | undefined);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/slug/:slug - Get course by slug
export const getCourseBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { userId } = req.query;

    const course = await courseService.getCourseBySlug(slug, userId as string | undefined);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/:id/related - Get related courses
export const getRelatedCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    const courses = await courseService.getRelatedCourses(
      id,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/trending - Get trending courses
export const getTrendingCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;

    const courses = await courseService.getTrendingCourses(
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/courses - Create course
export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      slug,
      description,
      categoryId,
      trainerId,
      thumbnailImage,
      coverImage,
      language,
      level,
      duration,
      status,
      hasCertificate,
      tags,
      metadata,
      demoVideoId,
    } = req.body;

    // Validation
    if (!title || !slug || !categoryId || !trainerId) {
      return res.status(400).json({
        success: false,
        message: "Title, slug, categoryId, and trainerId are required",
      });
    }

    const course = await courseService.createCourse({
      title,
      slug,
      description,
      thumbnailImage,
      coverImage,
      language,
      level,
      duration,
      status,
      hasCertificate,
      tags,
      metadata,
      demoVideo: demoVideoId ? { connect: { id: demoVideoId } } : undefined,
      category: { connect: { id: categoryId } },
      trainer: { connect: { id: trainerId } },
    });

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/courses/:id - Update course
export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      trainerId,
      title,
      slug,
      description,
      categoryId,
      thumbnailImage,
      coverImage,
      language,
      level,
      duration,
      status,
      hasCertificate,
      tags,
      metadata,
      demoVideoId,
    } = req.body;

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (trainerId !== undefined) updateData.trainer = trainerId;
    if (description !== undefined) updateData.description = description;
    if (thumbnailImage !== undefined) updateData.thumbnailImage = thumbnailImage;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (language !== undefined) updateData.language = language;
    if (level !== undefined) updateData.level = level;
    if (duration !== undefined) updateData.duration = duration;
    if (status !== undefined) updateData.status = status;
    if (hasCertificate !== undefined) updateData.hasCertificate = hasCertificate;
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (demoVideoId !== undefined) updateData.demoVideoId = demoVideoId;

    if (categoryId !== undefined) {
      updateData.category = { connect: { id: categoryId } };
    }

    // If changing course trainer (admin only)
    if (trainerId !== undefined) {
      updateData.trainer = { connect: { id: trainerId } };
    }

    const course = await courseService.updateCourse(id, updateData);

    res.json({
      success: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/courses/:id - Delete course (Admin only)
export const deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await courseService.deleteCourse(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/courses/:id/publish - Publish/Unpublish course
export const togglePublish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || (status !== "active" && status !== "inactive" && status !== "archived")) {
      return res.status(400).json({
        success: false,
        message: "status must be 'active', 'inactive', or 'archived'",
      });
    }
    const course = await courseService.togglePublish(id, status as CourseStatus);

    res.json({
      success: true,
      message: `Course status updated to ${status} successfully`,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/trainer/:trainerId - Get courses by trainer
export const getCoursesByTrainer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainerId } = req.params;
    const { includeUnpublished } = req.query;

    const courses = await courseService.getCoursesByTrainer(
      trainerId,
      includeUnpublished === "true"
    );

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};
