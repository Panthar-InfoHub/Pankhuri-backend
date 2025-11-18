import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", categoryController.getAllCategories);
router.get("/flat", categoryController.getFlatCategories);
router.get("/:id", categoryController.getCategoryById);
router.get("/slug/:slug", categoryController.getCategoryBySlug);
router.get("/:id/children", categoryController.getChildCategories);

// Admin routes (protected)
router.post("/", authenticate, requireAdmin, categoryController.createCategory);
router.put("/:id", authenticate, requireAdmin, categoryController.updateCategory);
router.delete("/:id", authenticate, requireAdmin, categoryController.deleteCategory);
router.patch("/:id/sequence", authenticate, requireAdmin, categoryController.updateSequence);
router.patch("/:id/status", authenticate, requireAdmin, categoryController.toggleStatus);

export default router;
