import { s3Client } from "@/lib/s3Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { Readable } from "stream";

export const streamVideo = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const file_key: any = req.params.filePath;
        const key = file_key.join('/');
        console.log("Streaming video with key:", key);

        const command = new GetObjectCommand({
            Bucket: process.env.DO_BUCKET!,
            Key: key,
        })

        const response = await s3Client.send(command);

        if (!response.Body) {
            return res.status(404).json({
                success: false,
                error: "Video not found in cloud storage.",
            });
        }

        res.set('Content-Type', response.ContentType || 'video/mp4');
        res.set('Content-Length', response.ContentLength?.toString() || '0');
        res.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
        res.set('Accept-Ranges', 'bytes');

        const stream =
            response.Body instanceof Readable
                ? response.Body
                : Readable.fromWeb(response.Body as any);

        stream.pipe(res);

    } catch (error) {
        console.error("Stream video error:", error);
        next(error);
    }
}