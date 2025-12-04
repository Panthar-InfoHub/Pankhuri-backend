import { prisma } from "@/lib/db";

export const createCertificateInDb = async (certificateData: { userId: string, certificateNumber: string, certificateUrl: string, metaData?: any }) => {
    try {

        return await prisma.certificate.create({
            data: {
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