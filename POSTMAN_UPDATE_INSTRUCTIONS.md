# Updated Postman Collection with FCM Token Support

The Postman collection has been updated to support the new FCM token architecture:

## Changes Made:

1. **Login Endpoints Updated:**
   - Google Login: Added optional cmToken field
   - Phone Login: Added optional cmToken field
   - Tokens are now stored in Session model only

2. **New FCM Token Endpoint Added:**
   - POST /api/auth/fcm-token
   - Updates FCM token for current session
   - Requires authentication

3. **Session Management:**
   - Max 2 active sessions per user
   - Old sessions automatically deleted
   - FCM tokens cleaned up via CASCADE

## How to Use:

### Login with FCM Token:
`json
POST /api/auth/google-verify
{
  "idToken": "firebase-token",
  "fcmToken": "device-fcm-token"  // Optional
}
`

### Update FCM Token:
`json
POST /api/auth/fcm-token
Authorization: Bearer {{authToken}}
{
  "fcmToken": "new-device-fcm-token"
}
`

Please manually add the following to your Postman collection under Authentication section:
