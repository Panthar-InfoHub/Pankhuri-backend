import { Router } from "express";
import * as faqController from "@/controllers/faq.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = Router();

// ==================== PUBLIC ====================

// GET /api/faqs - Public: Get all active global FAQs (landing page)
router.get("/", faqController.getGlobalFaqsHandler);

// ==================== ADMIN ====================

// GET /api/faqs/admin?type=global|course&courseId=xxx - Admin: List FAQs (includes inactive)
router.get("/admin", authenticateWithSession, requireAdmin, faqController.getAdminFaqsHandler);

// POST /api/faqs/admin/global - Admin: Create global FAQ
router.post("/admin/global", authenticateWithSession, requireAdmin, faqController.createGlobalFaqHandler);

// POST /api/faqs/admin/course - Admin: Create course FAQ
router.post("/admin/course", authenticateWithSession, requireAdmin, faqController.createCourseFaqHandler);

// PATCH /api/faqs/admin/reorder - Admin: Reorder FAQs (must be before /:id routes)
router.patch("/admin/reorder", authenticateWithSession, requireAdmin, faqController.reorderFaqsHandler);

// PATCH /api/faqs/admin/global/:id - Admin: Update global FAQ
router.patch("/admin/global/:id", authenticateWithSession, requireAdmin, faqController.updateGlobalFaqHandler);

// PATCH /api/faqs/admin/course/:id - Admin: Update course FAQ
router.patch("/admin/course/:id", authenticateWithSession, requireAdmin, faqController.updateCourseFaqHandler);

// DELETE /api/faqs/admin/:id - Admin: Delete any FAQ
router.delete("/admin/:id", authenticateWithSession, requireAdmin, faqController.deleteFaqHandler);

export default router;
