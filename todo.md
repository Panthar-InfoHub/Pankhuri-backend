----------------------
testing 

- check when i subscribe and cancel it is it cancelling in razorpay as well? 
- is course deleeting ?
- if i delte the course it must delete the plan from razorpay as well - and also the user subscription - and media and attached lesson modules , text lesson video lesson description attachements.
- can i access course if i am not subscribed ?
- if i purchase a plan and it pricing change then what amount i will be charged ?
- if i delete plan do old users deactivate the plan or what?
- and all this works for couse or not
- if i have purchsed the paren categroy then what hapepen if i try to buy child categroy
- properly chcek the trial flow also , cours will not have trial , category hwhole app trail , no of trial , trial duration , trial end date etc
- updating the price and other details of the plans
----------------------
done

- categroy is not creating plan in razorpay
- video clean up process - so it also delte from the bucket
- when i delte course or category it must also deactivate the plan 
- make edit flow as well inscluding plans  so they can change the pricing for the category and course
- scheduling the videos

----------------------
pending

- trial logic 
- deeplinks


----------------------
future

3. app notifications - like new video etc
1. analytics only add google scripts
- sharing using deeplinks

----------------------
optimisation

- what to do if i have a pending subscription plan- some way to manage it
1. cleanup expired sessions , cron
2.  Currently, your session.middleware.ts calls validateSession on every single request.
    -   Result: If 1,000 users are browsing your site, your database has to handle 1,000 extra queries per second just to check if the session is still valid.
    -   Scale Impact: Databases (PostgreSQL/MySQL) are much slower than RAM. At a certain point, your database will spend more time checking sessions than actually serving course data.

