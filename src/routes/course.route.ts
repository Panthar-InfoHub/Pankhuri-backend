import { Router } from "express";
import * as courseController from "../controllers/course.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = Router();

// Public routes
router.get("/", courseController.getAllCourses);
router.get("/trending", courseController.getTrendingCourses);
router.get("/:id", courseController.getCourseById);
router.get("/slug/:slug", courseController.getCourseBySlug);
router.get("/:id/related", courseController.getRelatedCourses);
router.get("/trainer/:trainerId", courseController.getCoursesByTrainer);

// Admin routes (protected) - For now only admin can manage courses
router.post("/", authenticateWithSession, requireAdmin, courseController.createCourse);
router.put("/:id", authenticateWithSession, requireAdmin, courseController.updateCourse);
router.delete("/:id", authenticateWithSession, requireAdmin, courseController.deleteCourse);
router.patch("/:id/publish", authenticateWithSession, requireAdmin, courseController.togglePublish);

export default router;
