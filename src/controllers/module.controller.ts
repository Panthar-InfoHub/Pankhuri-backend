import { Request, Response, NextFunction } from "express";
import {
  getModulesByCourse,
  getModuleById,
  getModuleBySlug,
  createModule,
  updateModule,
  deleteModule,
  bulkUpdateModuleSequences,
  updateModuleDuration,
  getNextModule,
  getPreviousModule,
} from "@services/module.service";
import { ModuleStatus } from "@/prisma/generated/prisma/client";
import { prisma } from "@/lib/db";

// ==================== GET MODULES ====================

/**
 * Get all modules for a course
 * GET /api/modules/course/:courseId
 */
export const getModulesByCourseHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId } = req.params;
    const { status } = req.query;

    const filters = {
      status: status as ModuleStatus | undefined,
    };

    const modules = await getModulesByCourse(courseId, filters);

    return res.status(200).json({
      success: true,
      data: modules,
      count: modules.length,
    });
  } catch (error: any) {
    console.error("Error fetching modules by course:", error);
    next(error);
  }
};

/**
 * Get module by ID
 * GET /api/modules/:id
 */
export const getModuleByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const module = await getModuleById(id);

    if (!module) {
      return res.status(404).json({
        success: false,
        error: "Module not found",
      });
    }

    // Get navigation (next/previous modules)
    const [nextModule, previousModule] = await Promise.all([
      getNextModule(module.courseId, module.sequence),
      getPreviousModule(module.courseId, module.sequence),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...module,
        navigation: {
          next: nextModule
            ? { id: nextModule.id, title: nextModule.title, slug: nextModule.slug }
            : null,
          previous: previousModule
            ? { id: previousModule.id, title: previousModule.title, slug: previousModule.slug }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching module by ID:", error);
    next(error);
  }
};

/**
 * Get module by slug
 * GET /api/modules/course/:courseId/slug/:slug
 */
export const getModuleBySlugHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, slug } = req.params;

    const module = await getModuleBySlug(courseId, slug);

    if (!module) {
      return res.status(404).json({
        success: false,
        error: "Module not found",
      });
    }

    // Get navigation (next/previous modules)
    const [nextModule, previousModule] = await Promise.all([
      getNextModule(module.courseId, module.sequence),
      getPreviousModule(module.courseId, module.sequence),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...module,
        navigation: {
          next: nextModule
            ? { id: nextModule.id, title: nextModule.title, slug: nextModule.slug }
            : null,
          previous: previousModule
            ? { id: previousModule.id, title: previousModule.title, slug: previousModule.slug }
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching module by slug:", error);
    next(error);
  }
};

// ==================== CREATE/UPDATE/DELETE MODULES ====================

/**
 * Create a new module
 * POST /api/modules
 */
export const createModuleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, title, slug, description, sequence, duration, metadata } = req.body;

    // Validation
    if (!courseId || !title || !slug || sequence === undefined) {
      return res.status(400).json({
        success: false,
        error: "courseId, title, slug, and sequence are required",
      });
    }

    const moduleData = {
      course: { connect: { id: courseId } },
      title,
      slug,
      description,
      sequence,
      duration,
      metadata,
      status: ModuleStatus.published,
    };

    const module = await createModule(moduleData);

    return res.status(201).json({
      success: true,
      message: "Module created successfully",
      data: module,
    });
  } catch (error: any) {
    console.error("Error creating module:", error);
    next(error);
  }
};

/**
 * Update module
 * PUT /api/modules/:id
 */
export const updateModuleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const module = await updateModule(id, updates);

    return res.status(200).json({
      success: true,
      message: "Module updated successfully",
      data: module,
    });
  } catch (error: any) {
    console.error("Error updating module:", error);
    next(error);
  }
};

/**
 * Delete module
 * DELETE /api/modules/:id
 */
export const deleteModuleHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await deleteModule(id);

    return res.status(200).json({
      success: true,
      message: "Module deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting module:", error);

    if (error.message.includes("Cannot delete module with lessons")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    next(error);
  }
};

/**
 * Bulk update module sequences
 * PATCH /api/modules/sequences
 */
export const bulkUpdateSequencesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: "Updates array is required",
      });
    }

    await bulkUpdateModuleSequences(updates);

    return res.status(200).json({
      success: true,
      message: "Module sequences updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating module sequences:", error);
    next(error);
  }
};

// ==================== MODULE STATUS ====================

/**
 * Update module status
 * PATCH /api/modules/:id/status
 */
export const updateModuleStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, updateLessons } = req.body;

    if (!status || !["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Valid status is required (draft, published, or archived)",
      });
    }

    const module = await updateModule(id, { status });

    // Optionally update all lessons in the module to the same status
    if (updateLessons) {
      await prisma.lesson.updateMany({
        where: { moduleId: id },
        data: { status },
      });
    }

    return res.status(200).json({
      success: true,
      message: updateLessons
        ? `Module and lessons ${status} successfully`
        : `Module ${status} successfully`,
      data: module,
    });
  } catch (error: any) {
    console.error("Error updating module status:", error);
    next(error);
  }
};

/**
 * Recalculate and update module duration
 * PATCH /api/modules/:id/duration
 */
export const updateModuleDurationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const module = await updateModuleDuration(id);

    return res.status(200).json({
      success: true,
      message: "Module duration updated successfully",
      data: module,
    });
  } catch (error: any) {
    console.error("Error updating module duration:", error);
    next(error);
  }
};
