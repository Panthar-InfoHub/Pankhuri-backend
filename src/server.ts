import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { connectDB, disconnectDB } from "@/lib/db";
import authRoutes from "@/routes/auth.route";
import userRoutes from "@/routes/user.route";
import certificateRoutes from "@/routes/certificate.route";
import videoRoutes from "@/routes/video.route";
import categoryRoutes from "@/routes/category.route";
import courseRoutes from "@/routes/course.route";
import moduleRoutes from "@/routes/module.route";
import lessonRoutes from "@/routes/lesson.route";
import sessionRoutes from "@/routes/session.route";
import progressRoutes from "@/routes/progress.route";
import reviewRoutes from "@/routes/review.route";
import { errorHandler } from "./middleware/error.middleware";

//Configurations
dotenv.config({
  quiet: true,
});

const app = express();

//Middlewares
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/certificate", certificateRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api", reviewRoutes);

//Health check
app.get("/ping", (_, res) => {
  res.status(200).send({ message: "server is running!" });
});

// 404 handler - must be before error middleware
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
    message: "Route not found",
  });
});

// Global error middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Then start the server
    const server = app.listen(PORT, () => {
      console.info(`🚀 Server is running on port ${PORT}`);
    });

    // Graceful shutdown
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

startServer();
