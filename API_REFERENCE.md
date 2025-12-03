# API Quick Reference - Subscription System

## 📋 Plans API

### Get All Active Plans (Public)

```http
GET /api/plans
```

### Get Plan by Slug (Public)

```http
GET /api/plans/slug/:slug
```

### Create Plan (Admin)

```http
POST /api/plans
Authorization: Bearer <admin_token>

{
  "name": "Premium Monthly",
  "slug": "premium-monthly",
  "subscriptionType": "monthly",
  "price": 49900,
  "discountedPrice": 39900,
  "currency": "INR",
  "billingInterval": "monthly",
  "trialDays": 7,
  "isPaidTrial": false,
  "trialFee": null,
  "features": {
    "courses": "unlimited",
    "support": "priority"
  },
  "order": 1
}
```

### Update Plan (Admin)

```http
PUT /api/plans/:id
Authorization: Bearer <admin_token>

{
  "name": "Premium Monthly Updated",
  "description": "New description",
  "isActive": true
}
```

### Delete Plan (Admin)

```http
DELETE /api/plans/:id
Authorization: Bearer <admin_token>
```

---

## 💳 Subscriptions API

### Initiate Subscription

```http
POST /api/subscriptions
Authorization: Bearer <user_token>

{
  "planId": "cm4odqkt20000h5jzukwsqx5l"
}
```

**Response (Free Trial):**

```json
{
  "success": true,
  "message": "Subscription initiated successfully",
  "data": {
    "requiresPayment": false,
    "subscription": {
      "id": "sub_123",
      "status": "pending",
      "isTrial": true
    }
  }
}
```

**Response (Paid Trial):**

```json
{
  "success": true,
  "message": "Payment required for trial",
  "data": {
    "requiresPayment": true,
    "orderId": "order_abc123",
    "amount": 9900,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

### Verify Paid Trial Payment

```http
POST /api/subscriptions/verify-trial-payment
Authorization: Bearer <user_token>

{
  "orderId": "order_abc123",
  "paymentId": "pay_xyz789",
  "signature": "signature_from_razorpay"
}
```

### Get Active Subscription

```http
GET /api/subscriptions/active
Authorization: Bearer <user_token>
```

### Get Subscription History

```http
GET /api/subscriptions
Authorization: Bearer <user_token>
```

### Get Subscription by ID

```http
GET /api/subscriptions/:id
Authorization: Bearer <user_token>
```

### Cancel at Period End

```http
POST /api/subscriptions/:id/cancel
Authorization: Bearer <user_token>
```

### Cancel Immediately

```http
POST /api/subscriptions/:id/cancel-immediately
Authorization: Bearer <user_token>
```

---

## 🔔 Webhooks API

### Payment Gateway Webhook

```http
POST /api/webhooks/payment
X-Razorpay-Signature: <signature>

{
  "event": "subscription.activated",
  "payload": { ... }
}
```

**Supported Events:**

- `subscription.activated`
- `subscription.cancelled`
- `subscription.halted`
- `subscription.charged`
- `order.paid`
- `invoice.generated`
- `invoice.paid`
- `invoice.payment_failed`

---

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message"
}
```

---

## 🔑 Authentication

All authenticated endpoints require:

```http
Authorization: Bearer <jwt_token>
```

Admin endpoints require user with `role: "admin"`.

---

## 💡 Frontend Integration Example

### Subscribe to Plan

```javascript
// Step 1: Initiate subscription
const response = await fetch("/api/subscriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ planId: selectedPlan.id }),
});

const data = await response.json();

// Step 2: Handle response
if (data.data.requiresPayment) {
  // Paid trial - show Razorpay checkout
  const options = {
    key: data.data.keyId,
    amount: data.data.amount,
    currency: data.data.currency,
    order_id: data.data.orderId,
    handler: async function (response) {
      // Step 3: Verify payment
      await fetch("/api/subscriptions/verify-trial-payment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: data.data.orderId,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }),
      });
    },
  };

  const rzp = new Razorpay(options);
  rzp.open();
} else {
  // Free trial - subscription created
  console.log("Subscription created:", data.data.subscription);
}
```

---

## 🎯 Status Values

### Subscription Status

- `pending` - Subscription created, waiting for activation
- `trial` - In trial period
- `active` - Active subscription
- `past_due` - Payment failed, in grace period
- `cancelled` - Subscription cancelled
- `halted` - Stopped after failed retries
- `expired` - Subscription expired

### Payment Status

- `pending` - Payment initiated
- `paid` - Payment successful
- `failed` - Payment failed
- `refunded` - Payment refunded

### Payment Type

- `trial` - Paid trial payment
- `recurring` - Recurring subscription payment
- `one_time` - One-time payment

---

## 🛠️ Testing with cURL

### Create Plan

```bash
curl -X POST http://localhost:8080/api/plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Monthly",
    "slug": "premium-monthly",
    "subscriptionType": "monthly",
    "price": 49900,
    "billingInterval": "monthly",
    "trialDays": 7,
    "isPaidTrial": false
  }'
```

### Subscribe to Plan

```bash
curl -X POST http://localhost:8080/api/subscriptions \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId": "cm4odqkt20000h5jzukwsqx5l"}'
```

### Get Active Subscription

```bash
curl -X GET http://localhost:8080/api/subscriptions/active \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

### Cancel Subscription

```bash
curl -X POST http://localhost:8080/api/subscriptions/SUB_ID/cancel \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

---

**💡 Tip:** Frontend should ONLY send `planId`. Backend determines everything else (price, trial, billing)!
