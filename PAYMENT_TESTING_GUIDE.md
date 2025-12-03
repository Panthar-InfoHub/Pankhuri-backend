# Payment Testing Guide - Razorpay with Postman

Complete guide to test payment flows using Postman and Razorpay test mode.

---

## 🚀 Quick Setup

### 1. Get Razorpay Test Credentials

1. **Sign up for Razorpay** (if not already):

   - Go to https://dashboard.razorpay.com/signup
   - Create a free account

2. **Get API Keys**:

   - Login to https://dashboard.razorpay.com
   - Go to **Settings** → **API Keys**
   - Click **Generate Test Key** (if not already generated)
   - You'll see:
     - **Key ID**: `rzp_test_xxxxxxxxxxxxx`
     - **Key Secret**: Click "Show" to reveal

3. **Get Webhook Secret**:
   - Go to **Settings** → **Webhooks**
   - Click **Create Webhook** or edit existing
   - Set URL: `https://your-domain.com/api/webhooks/payment` (use ngrok for local testing)
   - Select events: `subscription.activated`, `subscription.charged`, `invoice.paid`, etc.
   - Copy the **Secret** shown after creation

### 2. Configure Environment Variables

Create/update `.env` file in project root:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Database
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_url

# Other configs
PORT=8080
```

### 3. Import Postman Collection

1. Open Postman
2. Click **Import**
3. Select `Payment API.postman_collection.json`
4. Collection will be added to your workspace

### 4. Set Postman Variables

1. Click on the collection name
2. Go to **Variables** tab
3. Set values:
   - `baseUrl`: `http://localhost:8080`
   - `authToken`: (will be auto-filled after login)

---

## 🧪 Testing Flows

### Flow 1: Free Trial Subscription (No Payment Required)

#### Step 1: Login as User

```
Use the main API collection to login:
POST /api/auth/google-verify
or
POST /api/auth/phone-verify
```

This will auto-save `authToken`.

#### Step 2: Create a Free Trial Plan (Admin)

```http
POST {{baseUrl}}/api/plans
Authorization: Bearer {{authToken}}

Body:
{
  "name": "Monthly Free Trial",
  "slug": "monthly-free-trial",
  "description": "7 days free trial, then ₹999/month",
  "subscriptionType": "monthly",
  "price": 99900,
  "discountedPrice": null,
  "currency": "INR",
  "billingInterval": "monthly",
  "trialDays": 7,
  "isPaidTrial": false,
  "trialFee": null,
  "features": ["All courses", "HD videos", "Support"],
  "isActive": true,
  "order": 1
}
```

#### Step 3: Sync Plan to Razorpay (Admin)

```http
POST {{baseUrl}}/api/plans/{{planId}}/sync
Authorization: Bearer {{authToken}}
```

This creates the plan in Razorpay and saves the `planId`.

#### Step 4: Initiate Subscription (User)

```http
POST {{baseUrl}}/api/subscriptions
Authorization: Bearer {{authToken}}

Body:
{
  "planId": "{{planId}}"
}
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "userSubscriptionId": "sub_xxx",
    "subscriptionId": "sub_razorpay_xxx",
    "status": "pending",
    "isTrial": true
  }
}
```

#### Step 5: Simulate Razorpay Webhook (Activation)

Since Razorpay will automatically activate free trial subscriptions, you need to simulate the webhook:

```http
POST {{baseUrl}}/api/webhooks/payment
X-Razorpay-Signature: [generate signature - see below]

Body:
{
  "event": "subscription.activated",
  "payload": {
    "subscription": {
      "entity": {
        "id": "sub_razorpay_xxx",
        "status": "active",
        "current_start": 1701388800,
        "current_end": 1701993600,
        "charge_at": 1701993600
      }
    }
  }
}
```

#### Step 6: Verify Subscription Status

```http
GET {{baseUrl}}/api/subscriptions/active
Authorization: Bearer {{authToken}}
```

---

### Flow 2: Paid Trial (₹99 Trial Fee)

#### Step 1: Create Paid Trial Plan

```http
POST {{baseUrl}}/api/plans
Authorization: Bearer {{authToken}}

Body:
{
  "name": "Paid Trial - Monthly",
  "slug": "paid-trial-monthly",
  "description": "₹99 for 7 days trial, then ₹999/month",
  "subscriptionType": "monthly",
  "price": 99900,
  "currency": "INR",
  "billingInterval": "monthly",
  "trialDays": 7,
  "isPaidTrial": true,
  "trialFee": 9900,
  "features": ["All courses", "HD videos", "Support"],
  "isActive": true,
  "order": 1
}
```

#### Step 2: Sync to Razorpay

```http
POST {{baseUrl}}/api/plans/{{planId}}/sync
Authorization: Bearer {{authToken}}
```

#### Step 3: Initiate Subscription

```http
POST {{baseUrl}}/api/subscriptions
Authorization: Bearer {{authToken}}

Body:
{
  "planId": "{{planId}}"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "requiresPayment": true,
    "orderId": "order_razorpay_xxx",
    "amount": 9900,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx"
  }
}
```

#### Step 4: Simulate Payment (Frontend Integration)

In a real app, you'd integrate Razorpay Checkout. For testing without frontend:

**Option A: Use Razorpay Dashboard**

1. Go to Razorpay Dashboard → **Transactions**
2. Find the order
3. Mark it as "Paid" using test payment

**Option B: Use Razorpay Test Cards**

- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- OTP: `1234`

#### Step 5: Verify Payment

```http
POST {{baseUrl}}/api/subscriptions/verify-trial-payment
Authorization: Bearer {{authToken}}

Body:
{
  "userSubscriptionId": "{{subscriptionId}}",
  "razorpayOrderId": "order_razorpay_xxx",
  "razorpayPaymentId": "pay_razorpay_xxx",
  "razorpaySignature": "signature_from_razorpay"
}
```

---

### Flow 3: Testing Webhooks Locally with ngrok

#### Step 1: Install ngrok

```bash
# Download from https://ngrok.com/download
# Or use chocolatey on Windows:
choco install ngrok
```

#### Step 2: Start Your Server

```bash
npm run dev
```

#### Step 3: Create Tunnel

```bash
ngrok http 8080
```

You'll get a URL like: `https://abc123.ngrok.io`

#### Step 4: Configure Razorpay Webhook

1. Go to Razorpay Dashboard → **Settings** → **Webhooks**
2. Add webhook URL: `https://abc123.ngrok.io/api/webhooks/payment`
3. Select events:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `invoice.paid`
   - `payment.failed`
4. Copy the **Secret**

#### Step 5: Update .env

```env
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

#### Step 6: Test Webhooks

Now when you create subscriptions or payments in Razorpay, the webhooks will automatically hit your local server through ngrok!

---

## 🔐 Generating Webhook Signature (For Manual Testing)

To manually test webhooks in Postman, you need to generate the signature:

### Using Node.js Script

Create `test-webhook-signature.js`:

```javascript
const crypto = require("crypto");

const webhookSecret = "your_webhook_secret_here";
const payload = JSON.stringify({
  event: "subscription.activated",
  payload: {
    subscription: {
      entity: {
        id: "sub_razorpay_xxx",
        status: "active",
      },
    },
  },
});

const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

console.log("Signature:", signature);
```

Run:

```bash
node test-webhook-signature.js
```

Use the generated signature in `X-Razorpay-Signature` header.

---

## 📋 Test Scenarios Checklist

### Subscription Plans

- [ ] Create monthly plan
- [ ] Create yearly plan
- [ ] Create plan with free trial
- [ ] Create plan with paid trial
- [ ] Update plan details
- [ ] Sync plan to Razorpay
- [ ] Deactivate plan
- [ ] Delete plan (should fail if subscriptions exist)

### Free Trial Flow

- [ ] Initiate free trial subscription
- [ ] Verify subscription created in DB
- [ ] Simulate activation webhook
- [ ] Check subscription status is "trial"
- [ ] Verify trial end date is set correctly
- [ ] Wait for trial to end (or manually update dates)
- [ ] Simulate first payment webhook
- [ ] Verify status changes to "active"

### Paid Trial Flow

- [ ] Initiate paid trial subscription
- [ ] Verify order created
- [ ] Complete payment via Razorpay
- [ ] Verify trial payment
- [ ] Check subscription activated
- [ ] Verify payment record created

### Recurring Payments

- [ ] Simulate recurring payment webhook (invoice.paid)
- [ ] Verify payment record created
- [ ] Check subscription period updated
- [ ] Test payment failure webhook
- [ ] Verify subscription marked as "past_due"

### Cancellation

- [ ] Cancel at period end
- [ ] Verify `cancelAtPeriodEnd` flag set
- [ ] Verify subscription still active
- [ ] Cancel immediately
- [ ] Verify subscription status "cancelled"
- [ ] Verify access revoked

### Edge Cases

- [ ] Try subscribing with existing active subscription (should fail)
- [ ] Try subscribing to inactive plan (should fail)
- [ ] Invalid webhook signature (should reject)
- [ ] Duplicate webhook event (should be idempotent)
- [ ] Invalid payment verification (should fail)

---

## 🛠️ Razorpay Test Mode Features

### Test Cards (Always Successful)

```
Card Number: 4111 1111 1111 1111
Card Number: 5555 5555 5555 4444
CVV: Any 3 digits
Expiry: Any future date
```

### Test Cards (Specific Scenarios)

```
Failed Payment: 4000 0000 0000 0002
3D Secure Required: 4000 0027 6000 3184
```

### Test UPI

```
UPI ID: success@razorpay
OTP: 1234
```

### Test Wallets

All test wallets will succeed automatically.

---

## 🎯 Postman Tips

### 1. Use Environment Variables

Instead of hardcoding, use:

- `{{baseUrl}}`
- `{{authToken}}`
- `{{planId}}`
- `{{subscriptionId}}`

### 2. Auto-Save IDs with Test Scripts

The collection already includes scripts to auto-save IDs. Example:

```javascript
if (pm.response.code === 201) {
  const response = pm.response.json();
  pm.collectionVariables.set("planId", response.data.id);
}
```

### 3. Create a Test User

Save a test user token for quick testing:

```javascript
pm.collectionVariables.set("testUserToken", "your_long_jwt_token");
```

### 4. Use Pre-request Scripts

Add delays or generate dynamic data:

```javascript
// Generate unique slug
const timestamp = Date.now();
pm.variables.set("uniqueSlug", `plan-${timestamp}`);
```

---

## 🔍 Debugging Tips

### Check Razorpay Dashboard

- **Payments**: View all test payments
- **Subscriptions**: View subscription lifecycle
- **Webhooks**: See webhook delivery logs and retry failed webhooks

### Check Server Logs

```bash
npm run dev
```

Watch for:

- Webhook received logs
- Signature verification
- Database updates

### Check Database

```sql
-- View subscriptions
SELECT * FROM "UserSubscription" ORDER BY "createdAt" DESC;

-- View payments
SELECT * FROM "Payment" ORDER BY "createdAt" DESC;

-- View plans
SELECT * FROM "SubscriptionPlan" WHERE "isActive" = true;
```

---

## 📞 Support

### Razorpay Resources

- Dashboard: https://dashboard.razorpay.com
- API Docs: https://razorpay.com/docs/api
- Test Mode: https://razorpay.com/docs/payments/test-mode
- Webhooks: https://razorpay.com/docs/webhooks

### Common Issues

**Issue**: Webhook signature validation fails
**Solution**: Make sure webhook secret in .env matches Razorpay dashboard

**Issue**: Payment verification fails
**Solution**: Use correct signature format: `orderId|paymentId`

**Issue**: Subscription not activating
**Solution**: Check webhook delivery in Razorpay dashboard, retry if needed

**Issue**: Can't test locally
**Solution**: Use ngrok to expose localhost

---

## 🎉 Ready to Test!

1. ✅ Set up Razorpay test account
2. ✅ Configure .env variables
3. ✅ Import Postman collection
4. ✅ Start server: `npm run dev`
5. ✅ (Optional) Start ngrok: `ngrok http 8080`
6. ✅ Follow test flows above

Happy testing! 🚀
