import { Router } from "express";
import * as courseController from "../controllers/course.controller";
import { authenticateWithSession, requireAdmin, optionalAuthenticate } from "../middleware/session.middleware";

const router = Router();

// Public routes (with optional auth to detect ownership)
router.get("/", optionalAuthenticate, courseController.getAllCourses);
router.get("/trending", optionalAuthenticate, courseController.getTrendingCourses);
router.get("/:id", optionalAuthenticate, courseController.getCourseById);
router.get("/slug/:slug", optionalAuthenticate, courseController.getCourseBySlug);
router.get("/:id/related", optionalAuthenticate, courseController.getRelatedCourses);
router.get("/trainer/:trainerId", optionalAuthenticate, courseController.getCoursesByTrainer);

// Admin routes (protected) - For now only admin can manage courses
router.post("/", authenticateWithSession, requireAdmin, courseController.createCourse);
router.put("/:id", authenticateWithSession, requireAdmin, courseController.updateCourse);
router.delete("/:id", authenticateWithSession, requireAdmin, courseController.deleteCourse);
router.patch("/:id/publish", authenticateWithSession, requireAdmin, courseController.togglePublish);

export default router;
