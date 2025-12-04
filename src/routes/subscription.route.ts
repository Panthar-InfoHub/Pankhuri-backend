/**
 * Subscription Routes
 * Paid trial subscription endpoints
 */

import express from "express";
import {
  initiateSubscriptionHandler,
  getActiveSubscriptionHandler,
  getSubscriptionByIdHandler,
  getUserSubscriptionsHandler,
  cancelAtPeriodEndHandler,
  cancelImmediatelyHandler,
  getSubscriptionStatusHandler,
  cancelPendingSubscriptionHandler,
} from "@/controllers/subscription.controller";
import { authenticateWithSession, requireAdmin } from "@/middleware/session.middleware";

const router = express.Router();

// User routes
router.get("/status", authenticateWithSession, getSubscriptionStatusHandler);
router.delete("/pending", authenticateWithSession, cancelPendingSubscriptionHandler);
router.post("/", authenticateWithSession, initiateSubscriptionHandler);
router.get("/active", authenticateWithSession, getActiveSubscriptionHandler);
router.get("/", authenticateWithSession, getUserSubscriptionsHandler);
router.get("/:id", authenticateWithSession, getSubscriptionByIdHandler);
router.post("/:id/cancel", authenticateWithSession, cancelAtPeriodEndHandler);
router.post("/:id/cancel-immediately", authenticateWithSession, cancelImmediatelyHandler);

export default router;
