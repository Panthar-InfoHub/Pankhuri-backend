# Session Management System

## Overview

This session management system follows the **route-controller-service** architecture pattern and provides secure session handling with automatic cleanup for users with more than 2 active sessions.

## Architecture

```
├── services/
│   └── session.service.ts       # Session business logic
├── controllers/
│   └── session.controller.ts    # Session request handlers
├── routes/
│   └── session.route.ts         # Session API routes
├── middleware/
│   └── session.middleware.ts    # Session validation middleware
```

## Features

### 1. **Session Service** (`services/session.service.ts`)

Core session management functions:

- `createSession(userId, expiresAt?)` - Create a new session
- `getActiveSessions(userId)` - Get all non-expired sessions for a user
- `getAllUserSessions(userId)` - Get all sessions (including expired)
- `validateSession(sessionId)` - Check if session exists and is not expired
- `deleteSession(sessionId)` - Delete a specific session
- `deleteSessions(sessionIds[])` - Delete multiple sessions
- `deleteAllUserSessions(userId)` - Delete all sessions for a user
- `deleteExpiredSessions(userId)` - Clean up expired sessions
- `manageUserSessions(userId)` - **Main function** - Ensures max 2 active sessions
- `cleanupExpiredSessions()` - Global cleanup (can be used in cron jobs)

### 2. **Session Middleware** (`middleware/session.middleware.ts`)

#### `authenticateWithSession` Middleware
- Validates JWT token
- Manages user sessions (max 2 active sessions)
- Automatically removes oldest session if user has 2+ active sessions
- Attaches `req.user` and `req.sessionId` to request
- Returns `X-Session-Id` header in response

#### `authenticate` Middleware
- Simple JWT validation without session management
- Use for endpoints that don't require session tracking

#### `requireAdmin` Middleware
- Ensures user has admin role
- Must be used after authentication middleware

### 3. **Session Controller** (`controllers/session.controller.ts`)

Request handlers for session operations:

- `getUserActiveSessions` - Get active sessions
- `getAllSessions` - Get all sessions (including expired)
- `logoutCurrentSession` - Logout from current session
- `logoutSpecificSession` - Logout from a specific session
- `logoutAllSessions` - Logout from all sessions (logout everywhere)
- `cleanupSessions` - Admin-only cleanup of expired sessions

### 4. **Session Routes** (`routes/session.route.ts`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/sessions/active` | Get active sessions | Yes |
| GET | `/api/sessions` | Get all sessions | Yes |
| DELETE | `/api/sessions/current` | Logout current session | Yes |
| DELETE | `/api/sessions/:sessionId` | Logout specific session | Yes |
| DELETE | `/api/sessions/all/logout` | Logout all sessions | Yes |
| POST | `/api/sessions/cleanup` | Cleanup expired sessions | Admin only |

## Authentication Flow

### Login Flow (with Session Management)

1. User authenticates via Google/Phone
2. System checks for existing active sessions
3. If user has 2+ active sessions, oldest session(s) are deleted
4. New session is created
5. JWT is generated with session ID embedded
6. Response includes:
   - `token`: JWT token
   - `sessionId`: Session ID for tracking
   - `user`: User data

**Example Response:**
```json
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "sessionId": "clx1234567890abcdef",
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### Subsequent Requests

Clients should include:
- **Authorization header**: `Bearer <token>`
- **X-Session-Id header** (optional): Session ID for validation

**Example:**
```http
GET /api/sessions/active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Session-Id: clx1234567890abcdef
```

## Session Validation Rules

1. **Maximum Active Sessions**: 2 per user
2. **Session Expiry**: 7 days (default, configurable)
3. **Automatic Cleanup**: When user has 2+ sessions, oldest is removed
4. **Session Validation**: 
   - Check if session exists
   - Check if not expired
   - Verify session belongs to authenticated user

## Usage Examples

### 1. Using Session Middleware in Routes

```typescript
import { authenticateWithSession } from "../middleware/session.middleware";

// Protected route with session management
router.get("/profile", authenticateWithSession, getUserProfile);

// Protected route without session management
router.get("/public-data", authenticate, getPublicData);

// Admin-only route
router.delete("/users/:id", authenticateWithSession, requireAdmin, deleteUser);
```

### 2. Accessing Session in Controllers

```typescript
export const someController = async (req: Request, res: Response) => {
  const userId = req.user!.id;        // User ID from JWT
  const sessionId = req.sessionId;    // Current session ID
  
  // Your logic here
};
```

### 3. Manual Session Management

```typescript
import { manageUserSessions } from "../services/session.service";

// Create session with automatic cleanup
const session = await manageUserSessions(userId);

// Check active sessions
const activeSessions = await getActiveSessions(userId);
console.log(`User has ${activeSessions.length} active sessions`);
```

### 4. Client-Side Session Handling

**Store session ID after login:**
```javascript
const response = await fetch('/api/auth/google-verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken })
});

const { token, sessionId } = response.data;

// Store both token and sessionId
localStorage.setItem('token', token);
localStorage.setItem('sessionId', sessionId);
```

**Include in subsequent requests:**
```javascript
fetch('/api/sessions/active', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'X-Session-Id': localStorage.getItem('sessionId')
  }
});
```

**Logout from current session:**
```javascript
fetch('/api/sessions/current', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Session-Id': sessionId
  }
});
```

**Logout from all sessions:**
```javascript
fetch('/api/sessions/all/logout', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Database Schema

The `Session` model (already defined in `prisma/models/seession.prisma`):

```prisma
model Session {
    id        String   @id @default(cuid())
    userId    String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    expiresAt DateTime @default(dbgenerated("now() + interval '7 days'"))

    //Relations
    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Security Considerations

1. **Session ID in JWT**: Session ID is embedded in JWT payload for validation
2. **Automatic Cleanup**: Prevents session accumulation attacks
3. **Expiry Validation**: Sessions are checked for expiry on each request
4. **User Verification**: Sessions are verified to belong to the authenticated user
5. **Cascade Delete**: Sessions are automatically deleted when user is deleted

## Background Jobs (Optional)

You can set up a cron job to clean up expired sessions:

```typescript
import cron from 'node-cron';
import { cleanupExpiredSessions } from './services/session.service';

// Run cleanup every day at midnight
cron.schedule('0 0 * * *', async () => {
  const deletedCount = await cleanupExpiredSessions();
  console.log(`Cleaned up ${deletedCount} expired sessions`);
});
```

Or call the cleanup endpoint manually:
```bash
POST /api/sessions/cleanup
Authorization: Bearer <admin-token>
```

## Updated Controllers

All authentication controllers now create sessions:
- `googleLogin` - Creates session on Google login
- `phoneLogin` - Creates session on phone login  
- `googleVerifyAdmin` - Creates session on admin login

Each returns `sessionId` in the response along with the JWT token.

## Migration Notes

If you need to run Prisma migrations:
```bash
npx prisma migrate dev --name add_session_management
npx prisma generate
```

## Testing

### Test Session Limit
1. Login 3 times with the same account
2. Check active sessions - should only show 2 (latest)
3. Oldest session should be automatically removed

### Test Session Validation
1. Login and get sessionId
2. Make request with valid sessionId - should succeed
3. Delete session via `/api/sessions/current`
4. Make request with same sessionId - should fail (401)

### Test Logout
1. Login to get session
2. Call `/api/sessions/current` DELETE
3. Verify session is deleted from database
4. Subsequent requests with that session should fail
