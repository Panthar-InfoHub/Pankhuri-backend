import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = Router();

// Public routes
router.get("/", categoryController.getAllCategories);
router.get("/flat", categoryController.getFlatCategories);
router.get("/:id", categoryController.getCategoryById);
router.get("/slug/:slug", categoryController.getCategoryBySlug);
router.get("/:id/children", categoryController.getChildCategories);

// Admin routes (protected)
router.post("/", authenticateWithSession, requireAdmin, categoryController.createCategory);
router.put("/:id", authenticateWithSession, requireAdmin, categoryController.updateCategory);
router.delete("/:id", authenticateWithSession, requireAdmin, categoryController.deleteCategory);
router.patch("/:id/sequence", authenticateWithSession, requireAdmin, categoryController.updateSequence);
router.patch("/:id/status", authenticateWithSession, requireAdmin, categoryController.toggleStatus);

export default router;
