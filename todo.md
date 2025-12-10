- payment and subscription
- delete user profile
- certificates 
- multistep form on signup
- for security only send data to user that needed not whole object and relation objects
- how can i support the related products for this
===================================================================

POST /play/purchase/confirm
body: {
  userId: string
  planId: string            // your SubscriptionPlan.id (or slug)
  productId: string         // e.g. "pro_subscription"
  basePlanId?: string       // optional, if you want to double-check mapping
  purchaseToken: string
  orderId?: string
}


Validate : subscription plan : SubscriptionPlan.planId
get purchase subscription
- user subscription : create or upsert 
acknowledge purchase subscription