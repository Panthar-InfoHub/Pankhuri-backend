import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticateWithSession, requireAdmin, optionalAuthenticate } from "../middleware/session.middleware";

const router = Router();

// Public routes
router.get("/", optionalAuthenticate, categoryController.getAllCategories);
router.get("/flat", optionalAuthenticate, categoryController.getFlatCategories);
router.get("/:id", optionalAuthenticate, categoryController.getCategoryById);
router.get("/slug/:slug", optionalAuthenticate, categoryController.getCategoryBySlug);
router.get("/:id/children", optionalAuthenticate, categoryController.getChildCategories);

// Admin routes (protected)
router.post("/", authenticateWithSession, requireAdmin, categoryController.createCategory);
router.put("/:id", authenticateWithSession, requireAdmin, categoryController.updateCategory);
router.delete("/:id", authenticateWithSession, requireAdmin, categoryController.deleteCategory);
router.patch("/:id/sequence", authenticateWithSession, requireAdmin, categoryController.updateSequence);
router.patch("/:id/status", authenticateWithSession, requireAdmin, categoryController.toggleStatus);

export default router;
