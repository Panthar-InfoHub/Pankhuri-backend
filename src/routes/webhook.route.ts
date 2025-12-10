/**
 * Webhook Routes
 * Payment gateway webhook endpoints
 */

import express from "express";
import { handlePaymentRtdnWebhook, handlePaymentWebhook } from "@/controllers/webhook.controller";

const router = express.Router();

// ==================== WEBHOOK ROUTES ====================

// Payment gateway webhook
// Public endpoint (verified via signature)
router.post("/payment", handlePaymentWebhook);
router.post("/payment-rtdn", handlePaymentRtdnWebhook);

export default router;
