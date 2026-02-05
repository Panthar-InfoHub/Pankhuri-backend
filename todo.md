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
done

- categroy is not creating plan in razorpay

----------------------
pending

- what to do if i have a pending subscription plan- some way to manage it
- make edit flow as well inscluding plans  so they can change the pricing for the category and course
- video clean up process - so it also delte from the bucket
- when i delte course or category it must also deactivate the plan 
- make edit flow as well inscluding plans  so they can change the pricing for the category and course
- video clean up process - so it also delte from the bucket
- when i delte course or category it must also deactivate the plan 
- what to do if i have a pending subscription plan- some way to manage it.

----------------------
future

4. scheduling the videos
3. app notifications - like new video etc
1. analytics only add google scripts

----------------------
optimisation

1. cleanup expired sessions , cron
2.  Currently, your session.middleware.ts calls validateSession on every single request.
    -   Result: If 1,000 users are browsing your site, your database has to handle 1,000 extra queries per second just to check if the session is still valid.
    -   Scale Impact: Databases (PostgreSQL/MySQL) are much slower than RAM. At a certain point, your database will spend more time checking sessions than actually serving course data.

