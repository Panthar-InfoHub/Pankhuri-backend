import crypto from 'crypto';

const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_API_VERSION = process.env.FB_API_VERSION || 'v19.0';

/**
 * SHA-256 Hashing for PII as required by Meta
 */
const hashData = (data: string | null | undefined): string | null => {
  if (!data) return null;
  return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
};

/**
 * Send Purchase Event to Facebook Conversions API
 * This is non-blocking and handles its own errors
 */
export const sendFbPurchaseEvent = (params: {
  email?: string | null;
  phone?: string | null;
  amount: number;
  currency: string;
  orderId?: string | null;
  paymentId?: string | null;
  itemName: string;
  itemType: string;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}) => {
  if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
    return;
  }

  const {
    email,
    phone,
    amount,
    currency,
    orderId,
    paymentId,
    itemName,
    itemType,
    clientIp,
    clientUserAgent,
    fbp,
    fbc,
  } = params;

  // Deduplication Event ID: Prioritize paymentId, then orderId
  const eventId = paymentId || orderId || `p_${Date.now()}`;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,
        user_data: {
          em: hashData(email),
          ph: hashData(phone),
          client_ip_address: clientIp || undefined,
          client_user_agent: clientUserAgent || undefined,
          fbp: fbp || undefined,
          fbc: fbc || undefined,
        },
        custom_data: {
          value: amount / 100, // Conversion from paise/cents to major units
          currency: currency || 'INR',
          content_name: itemName,
          content_category: itemType,
          content_ids: [orderId || paymentId],
          content_type: 'product',
        },
      },
    ],
  };

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

  // Non-blocking fetch: We don't 'await' this in the main flow
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json();
        console.error('[FB-CAPI] ❌ Failed to send event:', JSON.stringify(errorData));
      } else {
        console.log(`[FB-CAPI] ✅ Success: Purchase tracked for ${eventId} (${itemType})`);
      }
    })
    .catch((err) => {
      console.error('[FB-CAPI] ❌ Network Error:', err.message);
    });
};
