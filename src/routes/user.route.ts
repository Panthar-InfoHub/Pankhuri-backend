import express from "express";
import * as userController from "../controllers/user.controller";
import { authenticateWithSession, requireAdmin } from "../middleware/session.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Current user profile (requires authentication)
router.get("/me", authenticateWithSession, userController.getCurrentUser);
router.put("/me", authenticateWithSession, userController.updateCurrentUser);
router.delete("/me", authenticateWithSession, userController.deleteMe);

// Public trainer endpoints
router.get("/trainers", userController.getAllTrainersPublic);
router.get("/trainers/:id", userController.getTrainerByIdPublic);

// ==================== ADMIN ROUTES ====================

// User management
router.get("/admin/users", authenticateWithSession, requireAdmin, userController.getAllUsers);
router.get("/admin/users/:id", authenticateWithSession, requireAdmin, userController.getUserById);
router.post("/admin/users", authenticateWithSession, requireAdmin, userController.createUser);
router.put("/admin/users/:id", authenticateWithSession, requireAdmin, userController.updateUser);
router.delete("/admin/users/:id", authenticateWithSession, requireAdmin, userController.deleteUser);
router.patch(
  "/admin/users/:id/status",
  authenticateWithSession,
  requireAdmin,
  userController.updateUserStatus
);
router.patch(
  "/admin/users/:id/role",
  authenticateWithSession,
  requireAdmin,
  userController.updateUserRole
);

// Trainer management
router.get("/admin/trainers", authenticateWithSession, requireAdmin, userController.getAllTrainers);
router.get(
  "/admin/trainers/:id",
  authenticateWithSession,
  requireAdmin,
  userController.getTrainerById
);
router.post(
  "/admin/trainers",
  authenticateWithSession,
  requireAdmin,
  userController.createTrainerProfile
);
router.put(
  "/admin/trainers/:id",
  authenticateWithSession,
  requireAdmin,
  userController.updateTrainerProfile
);
router.delete(
  "/admin/trainers/:id",
  authenticateWithSession,
  requireAdmin,
  userController.deleteTrainerProfile
);

export default router;
