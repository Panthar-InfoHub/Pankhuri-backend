import { prisma } from "@/lib/db";
import { Request, Response, NextFunction } from "express";
import * as courseService from "../services/course.service";
import * as planService from "../services/plan.service";
import { CourseLevel, CourseStatus } from "@/prisma/generated/prisma/client";
import { deleteFromDO, extractKeyFromUrl } from "@/lib/cloud";

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
      userId: (req as any).user?.id || (req.query.userId as string),
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
    const { userId: queryUserId } = req.query;
    const userId = (req as any).user?.id || (queryUserId as string);

    const course = await courseService.getCourseById(id, userId);

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
    const { userId: queryUserId } = req.query;
    const userId = (req as any).user?.id || (queryUserId as string);

    const course = await courseService.getCourseBySlug(slug, userId);

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
      limit ? parseInt(limit as string) : undefined,
      (req as any).user?.id || (req.query.userId as string)
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
      limit ? parseInt(limit as string) : undefined,
      (req as any).user?.id || (req.query.userId as string)
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
      price,
      discountedPrice,
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

    // If price is provided, create a lifetime plan for this course
    let plan = null;
    if (price !== undefined && price > 0) {
      plan = await planService.createPlan({
        name: `${title} - Lifetime Access`,
        slug: `${slug}-lifetime`,
        description: `Lifetime access to ${title}`,
        subscriptionType: "lifetime",
        planType: "COURSE",
        targetId: course.id,
        price: price,
        discountedPrice: discountedPrice,
        currency: "INR",
        isActive: true,
        provider: "razorpay",
      });
    }

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: {
        ...course,
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};


// POST /api/admin/courses - Create course

export const bulkCreateCourses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courses } = req.body;

    console.log("Allbulk course --> ", courses)
    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Courses array is required",
      });
    }

    // Validate all courses first
    const validationErrors = [];
    for (const course of courses) {
      if (!course.title || !course.slug || !course.categoryId) {
        validationErrors.push({
          slug: course.slug,
          error: "Missing required fields (title, slug, categoryId, trainerId)",
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Step 1: Bulk insert courses
    const coursesData = courses.map(course => ({
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnailImage: course.thumbnailImage,
      coverImage: course.coverImage,
      language: course.language || "en",
      level: course.level,
      duration: course.duration,
      status: course.status || "active",
      hasCertificate: course.hasCertificate || false,
      tags: course.tags || [],
      metadata: course.metadata || {},
      categoryId: course.categoryId,
      trainerId: course.trainerId,
      demoVideoId: course.demoVideoId,
    }));

    await courseService.createCoursesBulk(coursesData);

    // Step 2: Fetch created courses
    const createdCourses = await prisma.course.findMany({
      where: {
        slug: { in: courses.map(c => c.slug) },
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    });

    // Step 3: Parallel plan creation with error handling
    const planPromises = courses
      .filter(course => course.price && course.price > 0)
      .map(async (course) => {
        const createdCourse = createdCourses.find(c => c.slug === course.slug);
        if (!createdCourse) return null;

        try {
          // This will create both DB plan AND Razorpay plan
          const plan = await planService.createPlan({
            name: `${course.title} - Lifetime Access`,
            slug: `${course.slug}-lifetime`,
            description: `Lifetime access to ${course.title}`,
            subscriptionType: "lifetime",
            planType: "COURSE",
            targetId: createdCourse.id,
            price: course.price,
            discountedPrice: course.discountedPrice,
            currency: "INR",
            isActive: true,
            provider: "razorpay",
            trialDays: 0,
            trialFee: 0,
          });

          return {
            success: true,
            courseSlug: course.slug,
            planId: plan.id,
          };
        } catch (error: any) {
          console.error(`Failed to create plan for ${course.slug}:`, error);
          return {
            success: false,
            courseSlug: course.slug,
            error: error.message,
          };
        }
      });

    const planResults = await Promise.allSettled(planPromises);

    const successfulPlans = planResults
      .filter(result => result.status === 'fulfilled' && result.value?.success)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    const failedPlans = planResults
      .filter(result => result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value?.success))
      .map(result =>
        result.status === 'rejected'
          ? { error: result.reason }
          : (result as PromiseFulfilledResult<any>).value
      );

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdCourses.length} courses and ${successfulPlans.length} plans`,
      data: {
        courses: createdCourses,
        plans: successfulPlans,
        failedPlans: failedPlans.length > 0 ? failedPlans : undefined,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: "One or more courses already exist (duplicate slug)",
      });
    }
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


    if (demoVideoId !== undefined) {
      updateData.demoVideo = demoVideoId
        ? { connect: { id: demoVideoId } }
        : { disconnect: true };
    }

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
    result.course.thumbnailImage
    result.course.coverImage

    const deleteKeys: { thumbnail_url?: string, cover_url?: string } = {};

    if (result.course.thumbnailImage) {
      deleteKeys["thumbnail_url"] = extractKeyFromUrl(result.course.thumbnailImage);
    }

    if (result.course.coverImage) {
      deleteKeys["cover_url"] = extractKeyFromUrl(result.course.coverImage);
    }

    console.log("Delete keys ==> ", deleteKeys)

    await Promise.all([
      deleteFromDO(deleteKeys.thumbnail_url!),
      deleteFromDO(deleteKeys.cover_url!),
    ]);




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
      (req as any).user?.id || (req.query.userId as string)
    );

    res.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};
