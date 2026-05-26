import { Request, Response, NextFunction } from "express";
import * as faqService from "@/services/faq.service";

// ==================== PUBLIC ====================

/**
 * GET /api/faqs
 * Public: Get all active global FAQs (for landing page)
 */
export const getGlobalFaqsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const faqs = await faqService.getGlobalFaqs();
    return res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN: READ ====================

/**
 * GET /api/admin/faqs?type=global|course&courseId=xxx
 * Admin: Get FAQs by type (includes inactive)
 */
export const getAdminFaqsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, courseId } = req.query;

    if (!type || (type !== "global" && type !== "course")) {
      return res.status(400).json({
        success: false,
        message: "Query param 'type' is required and must be 'global' or 'course'",
      });
    }

    if (type === "course" && !courseId) {
      return res.status(400).json({
        success: false,
        message: "Query param 'courseId' is required when type is 'course'",
      });
    }

    const faqs = await faqService.getAdminFaqs(
      type as "global" | "course",
      courseId as string | undefined
    );

    return res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN: CREATE ====================

/**
 * POST /api/admin/faqs/global
 * Admin: Create a global FAQ
 */
export const createGlobalFaqHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { question, answer, order, isActive, courseId } = req.body;

    // Strict validation: courseId must NOT be present
    if (courseId !== undefined && courseId !== null) {
      return res.status(400).json({
        success: false,
        message: "courseId must not be provided for global FAQs. Use the course FAQ endpoint instead.",
      });
    }

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "question and answer are required",
      });
    }

    const faq = await faqService.createGlobalFaq({ question, answer, order, isActive });

    return res.status(201).json({
      success: true,
      message: "Global FAQ created successfully",
      data: faq,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/faqs/course
 * Admin: Create a course FAQ
 */
export const createCourseFaqHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { courseId, question, answer, order, isActive } = req.body;

    // Strict validation: courseId MUST be present
    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required for course FAQs. Use the global FAQ endpoint for brand-level FAQs.",
      });
    }

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "question and answer are required",
      });
    }

    const faq = await faqService.createCourseFaq({ courseId, question, answer, order, isActive });

    return res.status(201).json({
      success: true,
      message: "Course FAQ created successfully",
      data: faq,
    });
  } catch (error: any) {
    // Handle course not found from service
    if (error.message?.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// ==================== ADMIN: UPDATE ====================

/**
 * PATCH /api/admin/faqs/global/:id
 * Admin: Update a global FAQ
 */
export const updateGlobalFaqHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { question, answer, order, isActive } = req.body;

    const faq = await faqService.updateGlobalFaq(id, { question, answer, order, isActive });

    return res.status(200).json({
      success: true,
      message: "Global FAQ updated successfully",
      data: faq,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message?.includes("belongs to a course")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * PATCH /api/admin/faqs/course/:id
 * Admin: Update a course FAQ
 */
export const updateCourseFaqHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { question, answer, order, isActive } = req.body;

    const faq = await faqService.updateCourseFaq(id, { question, answer, order, isActive });

    return res.status(200).json({
      success: true,
      message: "Course FAQ updated successfully",
      data: faq,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message?.includes("global FAQ")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ==================== ADMIN: DELETE ====================

/**
 * DELETE /api/admin/faqs/:id
 * Admin: Delete any FAQ (global or course)
 */
export const deleteFaqHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await faqService.deleteFaq(id);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ==================== ADMIN: REORDER ====================

/**
 * PATCH /api/admin/faqs/reorder
 * Admin: Reorder FAQs (batch update)
 */
export const reorderFaqsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items array is required. Format: [{ id: '...', order: 0 }, ...]",
      });
    }

    // Validate each item has id and order
    for (const item of items) {
      if (!item.id || typeof item.order !== "number") {
        return res.status(400).json({
          success: false,
          message: "Each item must have 'id' (string) and 'order' (number)",
        });
      }
    }

    const result = await faqService.reorderFaqs(items);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
