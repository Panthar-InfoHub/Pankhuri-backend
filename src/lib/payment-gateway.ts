/**
 * Payment Gateway Utility
 * Generic wrapper for payment gateway operations (currently Razorpay)
 * Easy to swap providers by changing implementation here
 */

import crypto from "crypto";

// ==================== CONFIGURATION ====================

const GATEWAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID!,
  keySecret: process.env.RAZORPAY_KEY_SECRET!,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
  baseUrl: "https://api.razorpay.com/v1",
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Make authenticated API request to payment gateway
 */
const makeGatewayRequest = async (method: string, endpoint: string, data?: any): Promise<any> => {
  console.log(`[RAZORPAY] ${method} ${endpoint}`);
  if (data) {
    console.log(`[RAZORPAY] Request data:`, JSON.stringify(data).substring(0, 200));
  }

  const auth = Buffer.from(`${GATEWAY_CONFIG.keyId}:${GATEWAY_CONFIG.keySecret}`).toString(
    "base64"
  );

  const response = await fetch(`${GATEWAY_CONFIG.baseUrl}${endpoint}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`[RAZORPAY] ❌ API Error:`, error.error?.description || error);
    throw new Error(`Payment gateway error: ${error.error?.description || "Unknown error"}`);
  }

  const result = await response.json();
  console.log(`[RAZORPAY] ✅ Response:`, result.id || "success");
  return result;
};

// ==================== PLAN OPERATIONS ====================

/**
 * Create subscription plan in payment gateway
 */
export const createGatewayPlan = async (planData: {
  name: string;
  amount: number;
  currency: string;
  period: "monthly" | "yearly";
  interval: number;
  description?: string;
}): Promise<{ id: string }> => {
  const response = await makeGatewayRequest("POST", "/plans", {
    period: planData.period,
    interval: planData.interval,
    item: {
      name: planData.name,
      amount: planData.amount,
      currency: planData.currency,
      description: planData.description,
    },
  });

  return { id: response.id };
};

/**
 * Get plan from payment gateway
 */
export const getGatewayPlan = async (planId: string): Promise<any> => {
  return await makeGatewayRequest("GET", `/plans/${planId}`);
};

// ==================== SUBSCRIPTION OPERATIONS ====================

/**
 * Create subscription in payment gateway
 */
export const createGatewaySubscription = async (subscriptionData: {
  planId: string;
  totalCount?: number;
  customerNotify?: boolean;
  startAt?: number;
  notes?: Record<string, string>;
  addons?: Array<{ item: { name: string; amount: number; currency: string } }>;
}): Promise<{ id: string; status: string; createdAt: number; shortUrl?: string }> => {
  console.log(`[RAZORPAY] Creating subscription with plan: ${subscriptionData.planId}`);

  const requestData: any = {
    plan_id: subscriptionData.planId,
    total_count: subscriptionData.totalCount,
    customer_notify: subscriptionData.customerNotify ?? 1,
    start_at: subscriptionData.startAt,
    notes: subscriptionData.notes,
  };

  // Add addons for paid trial fee
  if (subscriptionData.addons && subscriptionData.addons.length > 0) {
    requestData.addons = subscriptionData.addons;
    console.log(`[RAZORPAY] Adding trial fee addon:`, subscriptionData.addons[0]);
  }

  const response = await makeGatewayRequest("POST", "/subscriptions", requestData);

  console.log(`[RAZORPAY] Subscription created:`, {
    id: response.id,
    status: response.status,
    short_url: response.short_url,
  });

  return {
    id: response.id,
    status: response.status,
    createdAt: response.created_at,
    shortUrl: response.short_url,
  };
};

/**
 * Get subscription from payment gateway
 */
export const getGatewaySubscription = async (subscriptionId: string): Promise<any> => {
  return await makeGatewayRequest("GET", `/subscriptions/${subscriptionId}`);
};

/**
 * Cancel subscription in payment gateway
 */
export const cancelGatewaySubscription = async (
  subscriptionId: string,
  cancelAtCycleEnd: boolean = false
): Promise<{ id: string; status: string }> => {
  const response = await makeGatewayRequest("POST", `/subscriptions/${subscriptionId}/cancel`, {
    cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
  });

  return {
    id: response.id,
    status: response.status,
  };
};

// ==================== WEBHOOK VERIFICATION ====================

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  const generatedSignature = crypto
    .createHmac("sha256", GATEWAY_CONFIG.webhookSecret)
    .update(payload)
    .digest("hex");

  return generatedSignature === signature;
};

// ==================== GATEWAY CONFIGURATION ====================

/**
 * Get gateway configuration for frontend
 */
export const getGatewayConfig = () => {
  return {
    keyId: GATEWAY_CONFIG.keyId,
  };
};
