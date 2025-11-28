import { Router } from "express";
import * as reviewController from "@/controllers/review.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = Router();

// Optional auth middleware for GET requests
const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No token provided, proceed without user
    return next();
  }

  // Token provided, use standard auth
  authenticateWithSession(req, res, next);
};

// Public/Optional Auth
router.get("/courses/:courseId/reviews", optionalAuth, reviewController.listReviews);
router.get("/courses/:courseId/reviews/stats", reviewController.getCourseStats);

// User Routes (Authenticated)
router.post("/courses/:courseId/reviews", authenticateWithSession, reviewController.upsertReview);
router.put("/courses/:courseId/reviews", authenticateWithSession, reviewController.updateReview);
router.delete("/courses/:courseId/reviews", authenticateWithSession, reviewController.deleteReview);

// Admin Routes
router.delete(
  "/reviews/:reviewId",
  authenticateWithSession,
  requireAdmin,
  reviewController.adminDeleteReview
);

export default router;
