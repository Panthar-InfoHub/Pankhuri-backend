import { prisma } from "@/lib/db";
import { Prisma } from "@/prisma/generated/prisma/client";

export const createCertificateInDb = async (certificateData: { userId: string, courseId: string, certificateNumber: string, certificateUrl: string, metaData?: any }) => {
    try {

        return await prisma.certificate.create({
            data: {
                courseId: certificateData.courseId,
                userId: certificateData.userId,
                certificateNumber: certificateData.certificateNumber,
                certificateUrl: certificateData.certificateUrl,
                metaData: certificateData.metaData || {}
            }
        });

    } catch (error) {
        console.error("Create Certificate In DB error:", error);
        throw new Error("Failed to create certificate record in database");
    }
}

export const getAllCertificateByUserId = async (filter: {
    userId: string,
    page?: number;
    limit?: number;
}) => {
    try {
        const { userId, page = 1, limit = 30 } = filter;
        let orderBy: Prisma.CertificateOrderByWithRelationInput = { createdAt: "desc" };

        const [certificates, total] = await Promise.all([
            prisma.certificate.findMany({
                where: { userId },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.certificate.count({ where: { userId } }),
        ]);

        return {
            data: certificates,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };

    } catch (error) {

    }
} 