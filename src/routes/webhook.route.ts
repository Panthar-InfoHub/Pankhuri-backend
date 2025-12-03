/**
 * Webhook Routes
 * Payment gateway webhook endpoints
 */

import express from "express";
import { handlePaymentWebhook } from "@/controllers/webhook.controller";

const router = express.Router();

// ==================== WEBHOOK ROUTES ====================

// Payment gateway webhook
// Public endpoint (verified via signature)
router.post("/payment", handlePaymentWebhook);

export default router;
