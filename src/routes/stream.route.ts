import { streamVideo } from "@/controllers/stream.controller";
import { authenticateWithSession } from "@/middleware/session.middleware";
import express from "express";


const streamRouter = express.Router();

streamRouter.get("/{*filePath}", authenticateWithSession, streamVideo);

export default streamRouter;