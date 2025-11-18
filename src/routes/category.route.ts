import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
// import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.get("/", categoryController.getAllCategories);
router.get("/flat", categoryController.getFlatCategories);
router.get("/:id", categoryController.getCategoryById);
router.get("/slug/:slug", categoryController.getCategoryBySlug);
router.get("/:id/children", categoryController.getChildCategories);

// Admin routes (uncomment when auth middleware is ready)
// router.post('/', authenticate, isAdmin, categoryController.createCategory);
// router.put('/:id', authenticate, isAdmin, categoryController.updateCategory);
// router.delete('/:id', authenticate, isAdmin, categoryController.deleteCategory);
// router.patch('/:id/sequence', authenticate, isAdmin, categoryController.updateSequence);
// router.patch('/:id/status', authenticate, isAdmin, categoryController.toggleStatus);

// Temporary admin routes without auth (remove in production)
router.post("/", categoryController.createCategory);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);
router.patch("/:id/sequence", categoryController.updateSequence);
router.patch("/:id/status", categoryController.toggleStatus);

export default router;
