import express from "express";
import * as userController from "../controllers/user.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Current user profile (requires authentication)
router.get("/me", authenticate, userController.getCurrentUser);
router.put("/me", authenticate, userController.updateCurrentUser);

// Public trainer endpoints
router.get("/trainers", userController.getAllTrainersPublic);
router.get("/trainers/:id", userController.getTrainerByIdPublic);

// ==================== ADMIN ROUTES ====================

// User management
router.get("/admin/users", authenticate, requireAdmin, userController.getAllUsers);
router.get("/admin/users/:id", authenticate, requireAdmin, userController.getUserById);
router.post("/admin/users", authenticate, requireAdmin, userController.createUser);
router.put("/admin/users/:id", authenticate, requireAdmin, userController.updateUser);
router.delete("/admin/users/:id", authenticate, requireAdmin, userController.deleteUser);
router.patch(
  "/admin/users/:id/status",
  authenticate,
  requireAdmin,
  userController.updateUserStatus
);
router.patch("/admin/users/:id/role", authenticate, requireAdmin, userController.updateUserRole);

// Trainer management
router.get("/admin/trainers", authenticate, requireAdmin, userController.getAllTrainers);
router.get("/admin/trainers/:id", authenticate, requireAdmin, userController.getTrainerById);
router.post("/admin/trainers", authenticate, requireAdmin, userController.createTrainerProfile);
router.put("/admin/trainers/:id", authenticate, requireAdmin, userController.updateTrainerProfile);
router.delete(
  "/admin/trainers/:id",
  authenticate,
  requireAdmin,
  userController.deleteTrainerProfile
);

export default router;
