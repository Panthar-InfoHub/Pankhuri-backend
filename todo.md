- scheduling the videos
- streak system on what basis
- app notifications
- analytics
- signed url for videos



- Video description :
disclaimer
timestamps : [
  { time_interval : time_content }
]
decscripion (markdown string),


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





----------------------
- target id in subscription has no check it accespts eveything so need a check based on type
