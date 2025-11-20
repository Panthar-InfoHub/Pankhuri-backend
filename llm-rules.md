# Pankhuri Backend - LLM Development Rules

## Project Overview

- **Project Name**: Pankhuri Backend
- **Tech Stack**: Node.js, TypeScript, Express.js, Prisma ORM, Firebase Admin, PostgreSQL
- **Architecture**: Three-tier architecture (Routes → Controllers → Services)
- **Authentication**: Firebase Authentication + JWT tokens
- **API Style**: RESTful API with JSON responses

---

## 1. PROJECT STRUCTURE & ORGANIZATION

### Directory Structure

```
src/
├── config/          # Configuration files (firebase, etc.)
├── controllers/     # Request/response handlers
├── lib/            # Utility libraries (db, jwt, pub_sub)
├── middleware/     # Express middleware (auth, error)
├── prisma/         # Prisma schema and models
│   ├── models/     # Split Prisma models by domain
│   └── generated/  # Auto-generated Prisma client
├── routes/         # API route definitions
├── services/       # Business logic layer
└── server.ts       # Application entry point
```

### File Naming Conventions

- **Controllers**: `*.controller.ts` (e.g., `auth.controller.ts`)
- **Services**: `*.service.ts` (e.g., `user.service.ts`)
- **Routes**: `*.route.ts` (e.g., `category.route.ts`)
- **Middleware**: `*.middleware.ts` (e.g., `auth.middleware.ts`)
- **Prisma Models**: `*.prisma` (e.g., `user.prisma`, `course.prisma`)
- **Config Files**: Lowercase with extension (e.g., `firebase.ts`, `db.ts`)

### Import Path Aliases

Always use TypeScript path aliases defined in `tsconfig.json`:

```typescript
@/*                  → src/*
@controllers/*       → src/controllers/*
@services/*          → src/services/*
@lib/*              → src/lib/*
@middlewares/*       → src/middlewares/* (note: folder is middleware, alias is middlewares)
@config/*           → src/config/*
@routes/*           → src/routes/*
```

**Examples:**

```typescript
import { prisma } from "@/lib/db";
import { authenticate } from "@/middleware/auth.middleware";
import { findUserByEmail } from "@services/user.service";
import FirebaseAdmin from "@/config/firebase";
```

---

## 2. CODE STYLE & FORMATTING

### TypeScript Standards

- **Strict Mode**: Always enabled (`strict: true` in tsconfig)
- **Type Safety**: Never use `any` without `any` keyword explicitly when needed
- **Explicit Types**: Define return types for all functions
- **Interfaces vs Types**: Use `type` for unions/intersections, `interface` for object shapes

### Naming Conventions

- **Variables/Functions**: `camelCase` (e.g., `findUserByEmail`, `jwtToken`)
- **Types/Interfaces**: `PascalCase` (e.g., `UserRole`, `CourseLevel`)
- **Constants**: `SCREAMING_SNAKE_CASE` only for true constants (e.g., `const PORT = process.env.PORT || 8080`)
- **Enums**: `PascalCase` for enum name, `snake_case` for values
  ```typescript
  enum UserRole {
    user
    admin
  }
  enum Gender {
    male
    female
    other
    prefer_not_to_say
  }
  ```
- **Database Fields**: `camelCase` in Prisma schema and code
- **Boolean Fields**: Prefix with `is`, `has`, or `can` (e.g., `isEmailVerified`, `hasUsedTrial`, `hasCertificate`)

### Code Formatting

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Double quotes `"` for strings
- **Semicolons**: Required at end of statements
- **Line Length**: Prefer 100 characters max (not strict)
- **Trailing Commas**: Use in multiline objects/arrays

---

## 3. API RESPONSE PATTERNS

### Success Response Structure

All successful responses must follow this pattern:

```typescript
{
  success: true,
  message: "Optional success message",
  data: { /* response data */ },
  pagination?: { /* if applicable */ }
}
```

### Error Response Structure

All error responses must follow this pattern:

```typescript
{
  success: false,
  error: "Error message" | "Descriptive error text",
  message?: "Alternative field for error message",
  stack?: "Only in development environment"
}
```

### Pagination Response

When returning paginated data:

```typescript
{
  success: true,
  data: [ /* array of items */ ],
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5
  }
}
```

### HTTP Status Codes

- `200`: Success (GET, PUT, PATCH)
- `201`: Created (POST)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## 4. ARCHITECTURE PATTERNS

### Three-Tier Architecture

**ALWAYS** follow this pattern:

1. **Routes Layer** (`routes/*.route.ts`)
   - Define API endpoints
   - Apply middleware (authentication, validation)
   - Route requests to controllers
   - No business logic

```typescript
import express from "express";
import { googleLogin, phoneLogin } from "../controllers/auth.controller";

const router = express.Router();

router.post("/google-verify", googleLogin);
router.post("/phone-verify", phoneLogin);

export default router;
```

2. **Controllers Layer** (`controllers/*.controller.ts`)
   - Handle HTTP request/response
   - Validate request data
   - Call service layer functions
   - Format and send responses
   - Handle errors with try-catch
   - Use `next(error)` for error propagation

```typescript
export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;

    // Validation
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Firebase ID token is required",
      });
    }

    // Call service layer
    const firebaseUser = await verifyFirebaseToken(idToken);
    const user = await findOrCreateUserByEmail(firebaseUser.email);
    const token = generateJWT(user);

    // Send response
    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: { token, user },
    });
  } catch (error: any) {
    next(error);
  }
};
```

3. **Services Layer** (`services/*.service.ts`)
   - Business logic and data manipulation
   - Database operations via Prisma
   - No HTTP-specific code (no req/res)
   - Return data or throw errors
   - Reusable across controllers

```typescript
export const findOrCreateUserByEmail = async (
  email: string,
  displayName?: string,
  profileImage?: string
): Promise<User> => {
  let user = await findUserByEmail(email);

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: displayName || user.displayName,
        profileImage: profileImage || user.profileImage,
        isEmailVerified: true,
      },
    });
    return user;
  }

  user = await createUser({
    email,
    displayName,
    profileImage,
    isEmailVerified: true,
    status: UserStatus.active,
    role: UserRole.user,
  });

  return user;
};
```

### Separation of Concerns

- **Never** put business logic in controllers
- **Never** put HTTP logic in services
- **Never** access `req`/`res` in services
- **Always** use service layer for database operations

---

## 5. AUTHENTICATION & AUTHORIZATION

### Firebase Authentication

- Use Firebase Admin SDK for token verification
- Verify tokens in `auth.service.ts`
- Return standardized user info

### JWT Token Pattern

```typescript
// Generate JWT
const payload = {
  id: user.id,
  email: user.email,
  phone: user.phone,
  role: user.role,
};
const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
```

### Middleware Usage

```typescript
// In routes
router.get("/me", authenticate, userController.getCurrentUser);
router.get("/admin/users", authenticate, requireAdmin, userController.getAllUsers);
```

### Request User Extension

User is attached to `req.user` after authentication:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        phone?: string;
        role: UserRole;
        status: string;
      };
    }
  }
}
```

---

## 6. DATABASE & PRISMA PATTERNS

### Prisma Schema Organization

- Split models into separate files in `src/prisma/models/`
- Main schema: `src/prisma/index.prisma` (contains only generator and datasource)
- One model per file (e.g., `user.prisma`, `course.prisma`, `module.prisma`, `lesson.prisma`)
- Prisma config at root (`prisma.config.ts`) handles multi-file schema automatically
- No need for import statements - Prisma reads all files in the schema directory

### Prisma Client Usage

```typescript
import { prisma } from "@/lib/db";
import { User, UserRole, Prisma } from "@/prisma/generated/prisma/client";
```

### Database Operations Patterns

**Find Operations:**

```typescript
// Find unique
const user = await prisma.user.findUnique({
  where: { email },
});

// Find many with filters
const users = await prisma.user.findMany({
  where: { role: UserRole.admin },
  include: { trainerProfile: true },
  orderBy: { createdAt: "desc" },
});
```

**Create Operations:**

```typescript
const user = await prisma.user.create({
  data: {
    email,
    displayName,
    status: UserStatus.active,
    role: UserRole.user,
  },
});
```

**Update Operations:**

```typescript
const user = await prisma.user.update({
  where: { id: userId },
  data: { displayName: newName },
});
```

**Relations:**

```typescript
// Nested include
const course = await prisma.course.findUnique({
  where: { id },
  include: {
    category: true,
    trainer: {
      select: {
        id: true,
        displayName: true,
        profileImage: true,
      },
    },
  },
});
```

### Type-Safe Prisma Inputs

```typescript
// Use Prisma-generated types
export const createUser = async (userData: Prisma.UserCreateInput) => {
  return await prisma.user.create({ data: userData });
};

export const updateUser = async (
  userId: string,
  updates: Prisma.UserUpdateInput
): Promise<User | null> => {
  return await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
};
```

---

## 7. ERROR HANDLING & SECURITY

### Error Handling Pattern

**CRITICAL**: Never expose internal system details, file paths, or database errors to users. All error messages must be user-friendly and safe.

```typescript
// In controllers - always use try-catch
export const someHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Business logic
  } catch (error: any) {
    console.error("Error description:", error);

    // Handle specific errors
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    // Pass to global error handler
    next(error);
  }
};
```

### Global Error Middleware

Located at `src/middleware/error.middleware.ts` - **AUTOMATICALLY SANITIZES ALL ERRORS**:

```typescript
// Sanitize error messages to hide sensitive information
function sanitizeErrorMessage(error: any): string {
  const message = error.message || "";

  // Prisma errors - convert to user-friendly messages
  if (message.includes("Invalid `prisma.")) {
    if (message.includes("No 'Category' record")) {
      return "Category not found. Please select a valid category.";
    }
    if (message.includes("No 'Trainer' record")) {
      return "Trainer not found. Please select a valid trainer.";
    }
    if (message.includes("Unique constraint failed")) {
      return "A record with this information already exists.";
    }
    if (message.includes("Foreign key constraint failed")) {
      return "Invalid reference. Please check your input data.";
    }
    return "Invalid data provided. Please check your input.";
  }

  // Database error codes
  if (error.code) {
    switch (error.code) {
      case "P2002":
        return "A record with this information already exists.";
      case "P2003":
        return "Invalid reference. Please check your input data.";
      case "P2025":
        return "Record not found.";
      default:
        return "Database operation failed. Please try again.";
    }
  }

  // Return original only if it's a safe custom error
  if (!message.includes("prisma") && !message.includes("\\Users\\")) {
    return message;
  }

  return "Something went wrong. Please try again.";
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log full error server-side only
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", err);
  } else {
    console.error("Error:", err.message);
  }

  const statusCode = err.statusCode || 500;
  const userMessage = sanitizeErrorMessage(err);

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
```

### Service Layer Errors

**Use clear, user-friendly error messages**:

```typescript
// ✅ Good - user-friendly
if (!user) {
  throw new Error("User not found");
}

if (!category) {
  throw new Error("Category not found. Please select a valid category.");
}

// ✅ Good - validate before operations
export const validateCategory = async (categoryId: string): Promise<boolean> => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw new Error("Category not found. Please select a valid category.");
  }

  return true;
};

// ❌ Bad - exposes internal details
throw new Error(`Database error: ${dbError.message}`);

// ❌ Bad - exposes file paths
throw new Error(`Failed in file C:\Users\...`);
```

### Validation Before Database Operations

**ALWAYS validate foreign keys exist before creating records**:

```typescript
// ✅ Validate category exists before creating course
export const createCourse = async (data: Prisma.CourseCreateInput) => {
  // Validate category exists
  if (data.category && "connect" in data.category) {
    const categoryExists = await prisma.category.findUnique({
      where: { id: data.category.connect.id },
    });

    if (!categoryExists) {
      throw new Error("Category not found. Please select a valid category.");
    }
  }

  // Proceed with creation
  return await prisma.course.create({ data });
};
```

### Error Security Checklist

- [ ] Never expose file paths to users
- [ ] Never expose database schema details
- [ ] Never expose internal error messages from Prisma
- [ ] Always validate foreign keys before operations
- [ ] Always log full errors server-side (for debugging)
- [ ] Always return sanitized errors to users
- [ ] Use custom error messages for business logic violations
- [ ] Stack traces only in development environment

---

## 8. VALIDATION PATTERNS

### Request Validation

Always validate required fields in controllers before calling services:

```typescript
// Validation
if (!title || !slug || !categoryId || !trainerId) {
  return res.status(400).json({
    success: false,
    message: "Title, slug, categoryId, and trainerId are required",
  });
}

if (!idToken) {
  return res.status(400).json({
    success: false,
    error: "Firebase ID token is required",
  });
}
```

### Query Parameter Validation

```typescript
const { status, limit, offset } = req.query;

const filters = {
  status: status as string | undefined,
  limit: limit ? parseInt(limit as string) : undefined,
  offset: offset ? parseInt(offset as string) : undefined,
};
```

---

## 9. COMMENTS & DOCUMENTATION

### JSDoc Comments

Use JSDoc comments for controllers and exported functions:

```typescript
/**
 * Google OAuth login via Firebase
 * POST /api/auth/google
 */
export const googleLogin = async (req: Request, res: Response) => {
  // Implementation
};

/**
 * Verify Firebase ID token (works for all auth methods: Google, Phone, etc.)
 * Returns decoded token with Firebase UID and user info
 */
export const verifyFirebaseToken = async (idToken: string) => {
  // Implementation
};
```

### Section Comments

Use section comments to organize code in services:

```typescript
// ==================== BASIC USER OPERATIONS ====================

// ==================== ADMIN USER MANAGEMENT ====================

// ==================== AUTH HELPERS ====================
```

### Inline Comments

Use inline comments for complex logic or business rules:

```typescript
// Common country codes (you can expand this list)
const countryCodes: { [key: string]: string } = {
  "1": "US/CA", // US/Canada
  "91": "IN", // India
};

// Don't allow deletion of users with active courses (as trainer)
if (user._count.trainedCourses > 0) {
  // Soft delete - just deactivate
  await prisma.user.update({
    where: { id },
    data: { status: UserStatus.suspended },
  });
  return { message: "User deactivated (has courses as trainer)" };
}
```

### Configuration Comments

```typescript
//Configurations
dotenv.config({
  quiet: true,
});

//Middlewares
app.use(express.json());
```

---

## 10. ENVIRONMENT & CONFIGURATION

### Environment Variables

Store all configuration in `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `NODE_ENV`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Configuration Pattern

```typescript
import dotenv from "dotenv";

dotenv.config({
  quiet: true,
});

const PORT = process.env.PORT || 8080;
```

### Firebase Configuration

```typescript
const FirebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
```

---

## 11. ROUTE PATTERNS

### Route Organization

```typescript
// ==================== PUBLIC ROUTES ====================
router.get("/me", authenticate, userController.getCurrentUser);

// ==================== ADMIN ROUTES ====================
router.get("/admin/users", authenticate, requireAdmin, userController.getAllUsers);
```

### RESTful Route Conventions

```
GET    /api/courses              → getAllCourses
GET    /api/courses/:id          → getCourseById
GET    /api/courses/slug/:slug   → getCourseBySlug
POST   /api/courses              → createCourse
PUT    /api/courses/:id          → updateCourse
DELETE /api/courses/:id          → deleteCourse
PATCH  /api/courses/:id/status   → updateCourseStatus
```

### Admin Routes Pattern

```
GET    /api/admin/users          → Admin: Get all users
POST   /api/admin/users          → Admin: Create user
PUT    /api/admin/users/:id      → Admin: Update user
DELETE /api/admin/users/:id      → Admin: Delete user
PATCH  /api/admin/users/:id/role → Admin: Update role
```

---

## 12. SECURITY BEST PRACTICES

### Authentication Required

- All routes except auth and public endpoints require authentication
- Use `authenticate` middleware for protected routes
- Use `requireAdmin` middleware for admin-only routes

### Token Handling

```typescript
// Extract token from Authorization header
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return res.status(401).json({
    success: false,
    message: "No token provided",
  });
}
const token = authHeader.substring(7); // Remove "Bearer " prefix
```

### Role-Based Access Control

```typescript
if (req.user.role !== UserRole.admin) {
  return res.status(403).json({
    success: false,
    message: "Admin access required",
  });
}
```

### Resource Ownership Verification

```typescript
// Verify ownership if not admin
if (!isAdmin) {
  const course = await prisma.course.findUnique({
    where: { id },
    select: { trainerId: true },
  });

  if (!course || course.trainerId !== trainerId) {
    throw new Error("Unauthorized: You can only update your own courses");
  }
}
```

### Sensitive Data

- Never log sensitive data (passwords, tokens)
- Strip sensitive fields from responses
- Use environment variables for secrets

---

## 13. PRISMA-SPECIFIC RULES

### Enum Usage

```typescript
// Import enums from generated client
import { UserRole, UserStatus, Gender, CourseLevel } from "@/prisma/generated/prisma/client";

// Use in queries
where: { role: UserRole.admin, status: UserStatus.active }
```

### Query Optimization

```typescript
// Use select for specific fields
trainer: {
  select: {
    id: true,
    displayName: true,
    profileImage: true,
  },
}

// Use include for relations
include: {
  category: true,
  trainer: true,
}

// Use _count for counting relations
_count: {
  select: {
    trainedCourses: true,
  },
}
```

### Parallel Queries

```typescript
// Use Promise.all for parallel operations
const [users, total] = await Promise.all([
  prisma.user.findMany({ where, skip, take }),
  prisma.user.count({ where }),
]);
```

---

## 14. ASYNC/AWAIT PATTERNS

### Always Use Async/Await

```typescript
// ✅ Correct
export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  return user;
};

// ❌ Wrong - don't use .then()
export const getUser = (id: string) => {
  return prisma.user.findUnique({ where: { id } }).then((user) => user);
};
```

### Error Handling

```typescript
try {
  const result = await someAsyncOperation();
  return result;
} catch (error: any) {
  throw new Error(`Operation failed: ${error.message}`);
}
```

---

## 15. SERVER & APPLICATION LIFECYCLE

### Server Startup Pattern

```typescript
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Then start the server
    const server = app.listen(PORT, () => {
      console.info(`🚀 Server is running on port ${PORT}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      server.close(async () => {
        console.log("HTTP server closed");
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
```

### Middleware Order

```typescript
//Middlewares
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Global error middleware (MUST be last)
app.use(errorHandler);
```

---

## 16. LOGGING & DEBUGGING

### Console Logging Patterns

```typescript
// Use console.info for informational messages
console.info(`🚀 Server is running on port ${PORT}`);

// Use console.debug for debug messages
console.debug("Database connected....");

// Use console.error for errors
console.error("Error while connecting to database ==> ", error);

// Use console.log for development debugging
console.log("Firebase User:", firebaseUser);
```

### Development Logging

```typescript
// Conditional logging based on environment
log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],

// Include stack traces only in development
stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
```

---

## 17. WHEN CREATING NEW FEATURES

### Checklist for New Endpoints

1. **Create Prisma Model** (if needed) in `src/prisma/models/`
2. **Create Service Functions** in `src/services/*.service.ts`
   - Implement business logic
   - Database operations
   - Data validation
3. **Create Controller Functions** in `src/controllers/*.controller.ts`
   - Request validation
   - Call service layer
   - Response formatting
   - Error handling
4. **Create Routes** in `src/routes/*.route.ts`
   - Define endpoints
   - Apply middleware
   - Connect to controllers
5. **Register Routes** in `src/server.ts`
6. **Test** with Postman or similar tool

### Example: Adding a "Tag" Feature

```typescript
// 1. Prisma model (src/prisma/models/tag.prisma)
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 2. Service (src/services/tag.service.ts)
export const getAllTags = async () => {
  return await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });
};

// 3. Controller (src/controllers/tag.controller.ts)
export const getAllTagsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await getAllTags();
    return res.status(200).json({
      success: true,
      data: tags,
    });
  } catch (error: any) {
    next(error);
  }
};

// 4. Route (src/routes/tag.route.ts)
import express from "express";
import { getAllTagsHandler } from "../controllers/tag.controller";

const router = express.Router();
router.get("/", getAllTagsHandler);

export default router;

// 5. Register in server.ts
import tagRoutes from "@/routes/tag.route";
app.use("/api/tags", tagRoutes);
```

---

## 18. COMMON PATTERNS TO AVOID

### ❌ Don't Do This

```typescript
// Don't use any without explicitly typing
const data = req.body; // ❌

// Don't put business logic in controllers
export const createUser = async (req: Request, res: Response) => {
  const user = await prisma.user.create({ data: req.body }); // ❌
  res.json(user);
};

// Don't access req/res in services
export const createUser = async (req: Request) => { // ❌
  // services shouldn't know about HTTP
};

// Don't use then/catch
prisma.user.findMany().then(users => { ... }); // ❌
```

### ✅ Do This Instead

```typescript
// Type your variables
const data: CreateUserDto = req.body; // ✅

// Put business logic in services
export const createUser = async (req: Request, res: Response) => {
  const userData = req.body;
  const user = await createUserService(userData); // ✅
  res.json({ success: true, data: user });
};

// Services accept data, not req/res
export const createUserService = async (userData: Prisma.UserCreateInput) => {
  // ✅
  return await prisma.user.create({ data: userData });
};

// Use async/await
const users = await prisma.user.findMany(); // ✅
```

---

## 19. QUERY PATTERNS & FILTERING

### Filter Pattern

```typescript
const where: Prisma.CourseWhereInput = {
  ...(categoryId && { categoryId }),
  ...(level && { level }),
  ...(status && { status }),
  ...(tags &&
    tags.length > 0 && {
      tags: { hasSome: tags },
    }),
  ...(search && {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ],
  }),
};
```

### Pagination Pattern

```typescript
export const getAllCourses = async (filters?: { page?: number; limit?: number }) => {
  const { page = 1, limit = 20 } = filters || {};

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    data: courses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
```

### Sorting Pattern

```typescript
let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: "desc" };

switch (sort) {
  case "popular":
    orderBy = { rating: "desc" };
    break;
  case "title":
    orderBy = { title: "asc" };
    break;
}
```

---

## 20. FINAL GUIDELINES

### Code Quality

- **DRY**: Don't repeat yourself - extract common logic
- **KISS**: Keep it simple - avoid over-engineering
- **Explicit > Implicit**: Be clear about intentions
- **Type Safety**: Leverage TypeScript's type system
- **Error Handling**: Always handle errors gracefully
- **Testing**: Write code that's easy to test

### Before Committing Code

- [ ] Follows three-tier architecture
- [ ] Uses proper naming conventions
- [ ] Has proper error handling
- [ ] Returns consistent response format
- [ ] Uses TypeScript path aliases
- [ ] Has JSDoc comments for exported functions
- [ ] No console.logs in production code (use proper logging)
- [ ] Validates all user inputs
- [ ] Uses appropriate HTTP status codes
- [ ] Handles authentication/authorization correctly

### When in Doubt

1. Look at existing code in the same domain
2. Follow the established patterns
3. Maintain consistency with the codebase
4. Ask questions rather than making assumptions

---

## SUMMARY: Key Principles

1. **Architecture**: Routes → Controllers → Services (always)
2. **Naming**: camelCase variables, PascalCase types, snake_case enum values
3. **Responses**: Always `{ success: true/false, ... }` structure
4. **Imports**: Use `@/` path aliases
5. **Errors**: Try-catch in controllers, throw in services, global handler for unhandled
6. **Prisma**: Import from `@/prisma/generated/prisma/client`
7. **Auth**: Firebase for verification, JWT for sessions
8. **Types**: Always explicit, leverage Prisma types
9. **Async**: Always async/await, never then/catch
10. **Validation**: Controllers validate, services assume valid data
