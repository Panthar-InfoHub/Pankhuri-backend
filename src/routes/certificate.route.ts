import { createCertificate } from "@/controllers/certificate.controller";
import { authenticateWithSession } from "@/middleware/session.middleware";
import express from "express";

const router = express.Router();


router.post("/", authenticateWithSession, createCertificate);

export default router;
