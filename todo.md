- scheduling the videos
- app notifications - like new video etc
- analytics only google scripts
- make edit flow as well inscluding plans  so they can change the pricing for the category and course



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
