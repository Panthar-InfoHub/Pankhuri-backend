import { Router } from "express";
import * as courseController from "../controllers/course.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/", courseController.getAllCourses);
router.get("/trending", courseController.getTrendingCourses);
router.get("/:id", courseController.getCourseById);
router.get("/slug/:slug", courseController.getCourseBySlug);
router.get("/:id/related", courseController.getRelatedCourses);
router.get("/trainer/:trainerId", courseController.getCoursesByTrainer);

// Admin routes (protected) - For now only admin can manage courses
router.post("/", authenticate, requireAdmin, courseController.createCourse);
router.put("/:id", authenticate, requireAdmin, courseController.updateCourse);
router.delete("/:id", authenticate, requireAdmin, courseController.deleteCourse);
router.patch("/:id/publish", authenticate, requireAdmin, courseController.togglePublish);

export default router;
