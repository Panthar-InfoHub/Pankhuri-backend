/**
 * Webhook Controller
 * Handles payment gateway webhook events
 */

import { Request, Response, NextFunction } from "express";
import { verifyWebhookSignature } from "@/lib/payment-gateway";
import { processRTDN, processWebhook } from "@/services/webhook.service";

// ==================== WEBHOOK HANDLER ====================

/**
 * Handle payment gateway webhooks
 * POST /api/webhooks/payment
 * Public (but verified via signature)
 */
export const handlePaymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`\n[WEBHOOK] ==================== INCOMING WEBHOOK ====================`);
    console.log(`[WEBHOOK] Timestamp: ${new Date().toISOString()}`);
    console.log(`[WEBHOOK] Event type: ${req.body.event}`);

    // Get signature from headers
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      console.log(`[WEBHOOK] ❌ Missing webhook signature`);
      return res.status(400).json({
        success: false,
        message: "Missing webhook signature",
      });
    }

    // Get raw body (important: must be raw string, not parsed JSON)
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    console.log(`[WEBHOOK] Verifying webhook signature...`);
    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error(`[WEBHOOK] ❌ Invalid webhook signature - rejecting request`);
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }
    console.log(`[WEBHOOK] ✅ Signature verified successfully`);

    // Extract event type and payload
    const { event, payload } = req.body;

    if (!event) {
      console.log(`[WEBHOOK] ❌ Missing event type in webhook payload`);
      return res.status(400).json({
        success: false,
        message: "Missing event type",
      });
    }

    console.log(`[WEBHOOK] Processing event: ${event}`);
    console.log(`[WEBHOOK] Payload preview:`, JSON.stringify(payload).substring(0, 200) + "...");

    // Process webhook asynchronously (don't block response)
    processWebhook(event, req.body)
      .then(() => {
        console.log(`[WEBHOOK] ✅ Webhook processed successfully: ${event}`);
        console.log(`[WEBHOOK] ============================================================\n`);
      })
      .catch((error) => {
        console.error(`[WEBHOOK] ❌ Error processing webhook ${event}:`, error);
        console.log(`[WEBHOOK] ============================================================\n`);
      });

    // Return 200 immediately (critical for webhook retry logic)
    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (error: any) {
    console.error(`[WEBHOOK] ❌ Webhook error:`, error);
    console.log(`[WEBHOOK] ============================================================\n`);
    // Still return 200 to prevent retries for malformed requests
    return res.status(200).json({
      success: false,
      message: "Webhook processing error",
    });
  }
};

export const handlePaymentRtdnWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`\n ==================== INCOMING RTDN ====================`);


    const message = req.body.message;
    if (!message?.data) {
      console.log(`[RTDN] ❌ Missing message in request body`);
      return res.status(400).json({
        success: false,
        message: "Missing message in request body",
      });
    }
    console.log(`[RTDN] Message : ${message}`);

    const notification = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );

    console.log(`[RTDN] Payload preview:`, JSON.stringify(notification).substring(0, 200) + "...");

    // Process webhook asynchronously (don't block response)
    processRTDN(notification)
      .then(() => {
        console.log(`\n Webhook processed successfully: ${event}`);
      })
      .catch((error) => {
        console.error(`Error processing webhook ${event}:`, error);
      });

    // Return 200 immediately (critical for webhook retry logic)
    return res.status(200).json({
      success: true,
      message: "RTDN received",
    });
  } catch (error: any) {
    console.error(`\n Google play rtdn processing error ==> `, error);
    return res.status(200).json({
      success: false,
      message: "RTDN processing error",
    });
  }
};