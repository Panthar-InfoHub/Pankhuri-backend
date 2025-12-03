/**
 * Subscription Routes
 * User subscription endpoints
 */

import express from "express";
import {
    initiateSubscriptionHandler,
    verifyPaidTrialPaymentHandler,
    getActiveSubscriptionHandler,
    getSubscriptionByIdHandler,
    getUserSubscriptionsHandler,
    cancelAtPeriodEndHandler,
    cancelImmediatelyHandler,
    syncSubscriptionHandler,
} from "@/controllers/subscription.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";  

const router = express.Router();

// ==================== AUTHENTICATED ROUTES ====================

// Initiate subscription
router.post("/", authenticateWithSession, initiateSubscriptionHandler);

// Verify paid trial payment
router.post("/verify-trial-payment", authenticateWithSession, verifyPaidTrialPaymentHandler);

// Get user's active subscription
router.get("/active", authenticateWithSession, getActiveSubscriptionHandler);

// Get all user subscriptions (history)
router.get("/", authenticateWithSession, getUserSubscriptionsHandler);

// Get subscription by ID
router.get("/:id", authenticateWithSession, getSubscriptionByIdHandler);

// Cancel subscription at period end
router.post("/:id/cancel", authenticateWithSession, cancelAtPeriodEndHandler);

// Cancel subscription immediately
router.post("/:id/cancel-immediately", authenticateWithSession, cancelImmediatelyHandler);

// ==================== ADMIN ROUTES ====================

// Sync subscription from payment gateway
router.post("/:id/sync", authenticateWithSession, requireAdmin, syncSubscriptionHandler);

export default router;
