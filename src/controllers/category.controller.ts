import { Request, Response, NextFunction } from "express";
import * as categoryService from "../services/category.service";
import * as planService from "../services/plan.service";
import { CategoryStatus } from "@/prisma/generated/prisma/client";
import { prisma } from "../lib/db";
import { deleteFromDO, extractKeyFromUrl } from "@/lib/cloud";

// GET /api/categories - Get all categories (tree structure)
export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, userId: queryUserId } = req.query;
    const userId = (req as any).user?.id || (queryUserId as string);

    const categories = await categoryService.getAllCategories(status as CategoryStatus | undefined, userId);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/categories/flat - Get flat list with pagination
export const getFlatCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page, limit } = req.query;

    const result = await categoryService.getFlatCategories({
      status: status as CategoryStatus | undefined,
      search: search as string | undefined,
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

// GET /api/categories/:id - Get category by ID
export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { showNestedCourses, userId: queryUserId } = req.query;
    const userId = (req as any).user?.id || (queryUserId as string);

    const category = await categoryService.getCategoryById(id, showNestedCourses === "true", userId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/categories/slug/:slug - Get category by slug
export const getCategoryBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { showNestedCourses, userId: queryUserId } = req.query;
    const userId = (req as any).user?.id || (queryUserId as string);

    const category = await categoryService.getCategoryBySlug(slug, showNestedCourses === "true", userId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/categories/:id/children - Get child categories
export const getChildCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const children = await categoryService.getChildCategories(id);

    res.json({
      success: true,
      data: children,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------- admin ----------------------

// POST /api/admin/categories - Create category
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, slug, description, parentId, icon, status, sequence,
      pricing, discountedPrice, subscriptionType, currency = "INR"
    } = req.body;

    // Validation
    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }
    const category = await categoryService.createCategory({
      name,
      slug,
      description,
      icon,
      status,
      sequence,
      ...(parentId && {
        parent: {
          connect: { id: parentId },
        },
      }),
    });

    // If price is provided, create a subscription plan for this category
    let plan = null;
    if (pricing && pricing !== undefined) {

      plan = pricing.map(async (priceData: { type: "monthly" | "yearly", price: number, discountedPrice: number }) => {

        await planService.createPlan({
          name: `${name} - ${priceData.type || 'Monthly'} Subscription`,
          slug: `${slug}-${priceData.type || 'monthly'}`,
          description: `Subscription access to ${name} category`,
          subscriptionType: priceData.type,
          planType: "CATEGORY",
          targetId: category.id,
          price: priceData.price,
          discountedPrice: priceData.discountedPrice,
          currency: currency,
          isActive: true,
          provider: "razorpay"
        });

      })
    }

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: {
        ...category,
        plan
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/categories/:id - Update category
export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, slug, description, parentId, icon, status, sequence } = req.body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (status !== undefined) updateData.status = status;
    if (sequence !== undefined) updateData.sequence = sequence;

    if (parentId !== undefined) {
      updateData.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
    }

    const category = await categoryService.updateCategory(id, updateData);

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/categories/:id - Delete category
export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await categoryService.deleteCategory(id);

    if (result.category.icon) {
      await deleteFromDO(extractKeyFromUrl(result.category.icon))
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/categories/:id/sequence - Update sequence
export const updateSequence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sequence } = req.body;

    if (typeof sequence !== "number") {
      return res.status(400).json({
        success: false,
        message: "Sequence must be a number",
      });
    }

    const category = await categoryService.updateSequence(id, sequence);

    res.json({
      success: true,
      message: "Category sequence updated",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/categories/:id/status - Toggle status
export const toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "inactive"',
      });
    }

    const category = await categoryService.toggleStatus(id, status as CategoryStatus);

    res.json({
      success: true,
      message: "Category status updated",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};
