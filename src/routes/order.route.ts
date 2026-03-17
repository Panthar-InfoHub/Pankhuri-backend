import { Router } from "express";
import { getAdminOrdersHandler, getAdminOrderByIdHandler } from "@/controllers/order.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = Router();

// GET /api/admin/orders - Admin: Get all orders with filters, search, pagination & summary
router.get("/", authenticateWithSession, requireAdmin, getAdminOrdersHandler);

// GET /api/admin/orders/:id - Admin: Get order by ID
router.get("/:id", authenticateWithSession, requireAdmin, getAdminOrderByIdHandler);

export default router;
