import path from "path";
import { prisma } from "@/lib/db";
import os from "os";
import fs from "fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Client } from "@/lib/s3Client";
import { registerUser, sendMessage } from "@/lib/helper";
import { createCertificateInDb, getAllCertificateByUserId } from "@/services/certificate.service";
import { getCourseById } from "@/services/course.service";
import { getUserById } from "@/services/user.service";

export const createCertificate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { course_id, date: studentDate } = req.body;
        let { phone } = req.body;
        const userId = req.user!.id;

        if (!userId || !course_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields for certificate generation (course_id).",
            });
        }

        // 1. Fetch User and Course Details
        const [user, course] = await Promise.all([
            getUserById(userId),
            getCourseById(course_id)
        ]);

        if (!user || !user.displayName) {
            return res.status(404).json({
                success: false,
                message: "User not found or profile incomplete.",
            });
        }

        if (!course) {
            return res.status(404).json({
                success: false,
                message: "Course not found."
            });
        }

        // 2. Security Checks
        // A. Does the course provide a certificate?
        if (!course.hasCertificate) {
            return res.status(400).json({
                success: false,
                message: "This course does not provide a certificate."
            });
        }

        // B. Has the user completed the course?
        const progress = await prisma.userCourseProgress.findUnique({
            where: { userId_courseId: { userId, courseId: course_id } }
        });

        if (!progress || !progress.isCompleted) {
            return res.status(403).json({
                success: false,
                message: "You must complete the course before claiming your certificate."
            });
        }

        // C. Duplicate Check - return existing if already generated
        const existingCert = await prisma.certificate.findFirst({
            where: { userId, courseId: course_id }
        });

        if (existingCert) {
            return res.status(200).json({
                success: true,
                message: "Certificate already generated.",
                data: {
                    name: user.displayName,
                    publicUrl: existingCert.certificateUrl,
                }
            });
        }

        // 3. Fallbacks for missing optional data
        const date = studentDate ? studentDate : new Date().toISOString().split("T")[0];
        if (!phone) phone = user.phone;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required for certificate registration but missing from profile.",
            });
        }

        console.debug(`\n\n Creating certificate for: `, { name: user.displayName, course: course.title, date, phone })

        const cert_res = await fetch(`${process.env.CERTIFICATE_SERVICE_URL}/api/upload-certificate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                student: {
                    Name: user.displayName,
                    course: course.title,
                    date,
                    phone,
                }
            }),
        });

        const result = await cert_res.json();

        if (!result.success) {
            console.error("Certificate generation failed:", result.error);
            return res.status(400).json({
                success: false,
                message: "Failed to generate certificate.",
                error: result.error || "Unknown error occurred."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Certificate generation initiated. You will receive a notification once it's ready.",
            name: user.displayName,
            publicUrl: result.publicUrl,
        });

    } catch (error) {
        next(error);
    }
}

export const getCertificatesByUser = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const userId = req.user!.id;
        const page = req.query.page ? parseInt(req.query.page as string) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

        const result = await getAllCertificateByUserId({ userId, page, limit });

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        next(error);
    }
}