import { S3Client } from "@aws-sdk/client-s3";


// Initialize S3Client with DigitalOcean Spaces config
export const s3Client = new S3Client({
    endpoint: "https://blr1.digitaloceanspaces.com",
    region: "blr1",
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
    },
    forcePathStyle: false,
});