import express from "express";
import {
    getAllEntitlementsHandler,
    getTargetEntitlementsHandler,
    getMyEntitlementsHandler,
    revokeEntitlementHandler
} from "@/controllers/entitlement.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = express.Router();

// User Route: Get my active entitlements
router.get("/me", authenticateWithSession, getMyEntitlementsHandler);

// Admin Routes: Manage/View all entitlements
router.get("/admin/all", authenticateWithSession, requireAdmin, getAllEntitlementsHandler);
router.get("/admin/target", authenticateWithSession, requireAdmin, getTargetEntitlementsHandler);
router.post("/admin/revoke", authenticateWithSession, requireAdmin, revokeEntitlementHandler);

export default router;
