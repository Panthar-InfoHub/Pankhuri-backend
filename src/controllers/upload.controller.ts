import { Request, Response, NextFunction } from "express";
import { generateUploadUrl } from "@/lib/cloud";

/**
 * Generate a presigned URL for uploading an image
 * POST /api/upload/presigned-url
 */
export const getPresignedUrlHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileName, contentType, folder = "user-profile" } = req.body;

        if (!fileName || !contentType) {
            return res.status(400).json({
                success: false,
                error: "fileName and contentType are required",
            });
        }

        // Use BUCKET_MODE from env or default to 'dev'
        const bucketMode = process.env.DO_BUCKET_MODE || "dev";
        const timestamp = Date.now();

        // Clean file name to avoid issues with special characters
        const cleanFileName = fileName.replace(/[^a-zA-Z0-01._-]/g, "_");

        // Construct the key (path in the bucket)
        const key = `${bucketMode}/${folder}/${timestamp}_${cleanFileName}`;

        const { uploadUrl, publicUrl } = await generateUploadUrl(key, contentType);

        return res.status(200).json({
            success: true,
            data: {
                uploadUrl,
                publicUrl,
                key,
            },
        });
    } catch (error: any) {
        console.error("Error in getPresignedUrlHandler:", error);
        next(error);
    }
};
