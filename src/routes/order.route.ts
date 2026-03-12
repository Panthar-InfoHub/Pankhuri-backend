import { Router } from "express";
import { getAdminOrdersHandler } from "@/controllers/order.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = Router();

// GET /api/admin/orders - Admin: Get all orders with filters, search, pagination & summary
router.get("/", authenticateWithSession, requireAdmin, getAdminOrdersHandler);

export default router;
