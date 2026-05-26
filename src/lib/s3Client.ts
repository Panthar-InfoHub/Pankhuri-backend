import { S3Client } from "@aws-sdk/client-s3";


// Initialize S3Client with DigitalOcean Spaces config
export const s3Client = new S3Client({
    endpoint: "https://23f72b79499d3f2c54418b86dd1c284e.r2.cloudflarestorage.com",
    region: "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
});