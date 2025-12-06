/**
 * Payment Gateway Utility
 * Generic wrapper for payment gateway operations (currently Razorpay)
 * Easy to swap providers by changing implementation here
 */

import crypto from "crypto";
import razorpay from "@/config/razorpay";

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
  const response = await razorpay.plans.create({
    period: planData.period,
    interval: planData.interval,
    item: {
      name: planData.name,
      amount: planData.amount,
      currency: planData.currency,
      description: planData.description,
    },
  });

  console.log(`[RAZORPAY] ✅ Plan created:`, response.id);
  return { id: response.id };
};

/**
 * Get plan from payment gateway
 */
export const getGatewayPlan = async (planId: string): Promise<any> => {
  const response = await razorpay.plans.fetch(planId);
  return response;
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

  const response = await razorpay.subscriptions.create(requestData);

  console.log(`[RAZORPAY] Subscription created:`,response);

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
  const response = await razorpay.subscriptions.fetch(subscriptionId);
  return response;
};

/**
 * Cancel subscription in payment gateway
 */
export const cancelGatewaySubscription = async (
  subscriptionId: string,
  cancelAtCycleEnd: boolean = false
): Promise<{ id: string; status: string }> => {

  const response = await razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);

  return {
    id: response.id,
    status: response.status,
  };
};

// ==================== WEBHOOK VERIFICATION ====================

export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");

  return generatedSignature === signature;
};
