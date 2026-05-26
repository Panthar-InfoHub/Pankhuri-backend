import express from "express";
import { 
  getBrandSettingsHandler, 
  updateBrandSettingsHandler 
} from "@/controllers/brandSetting.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = express.Router();

// Public route to get settings
router.get("/", getBrandSettingsHandler);

// Admin only route to update settings
router.patch("/", authenticateWithSession, requireAdmin, updateBrandSettingsHandler);

export default router;
