import { Request, Response, NextFunction } from "express";

// Sanitize error messages to hide sensitive information
function sanitizeErrorMessage(error: any): string {
  const message = error.message || "";

  // Prisma errors
  if (message.includes("Invalid `prisma.")) {
    if (message.includes("No 'Category' record")) {
      return "Category not found. Please select a valid category.";
    }
    if (message.includes("No 'Trainer' record")) {
      return "Trainer not found. Please select a valid trainer.";
    }
    if (message.includes("No 'User' record")) {
      return "User not found.";
    }
    if (message.includes("Unique constraint failed")) {
      return "A record with this information already exists.";
    }
    if (message.includes("Foreign key constraint failed")) {
      return "Invalid reference. Please check your input data.";
    }
    if (message.includes("Record to update not found")) {
      return "Record not found.";
    }
    return "Invalid data provided. Please check your input.";
  }

  // Database errors
  if (error.code) {
    switch (error.code) {
      case "P2002":
        return "A record with this information already exists.";
      case "P2003":
        return "Invalid reference. Please check your input data.";
      case "P2025":
        return "Record not found.";
      case "P2014":
        return "Invalid data relationship.";
      default:
        return "Database operation failed. Please try again.";
    }
  }

  // Return original message if it's a custom error
  if (
    !message.includes("prisma") &&
    !message.includes("\\Users\\") &&
    !message.includes("invocation")
  ) {
    return message;
  }

  return "Something went wrong. Please try again.";
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Log full error for debugging (server-side only)
  if (process.env.NODE_ENV === "development") {
    console.error("Error:", err);
  } else {
    // In production, log minimal info
    console.error("Error:", err.message);
  }

  const statusCode = err.statusCode || 500;
  const userMessage = sanitizeErrorMessage(err);

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    // Only show stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
