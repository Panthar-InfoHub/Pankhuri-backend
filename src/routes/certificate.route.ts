import { createCertificate } from "@/controllers/caertificate.controller";
import express from "express";

const router = express.Router();


router.post("/", createCertificate);

export default router;
