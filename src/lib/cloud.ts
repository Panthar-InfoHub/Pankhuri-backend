import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT! ,// e.g., https://sgp1.digitaloceanspaces.com
  region: process.env.DO_SPACES_REGION ! ,// e.g., sgp1
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
});

/**
 * Generate a signed URL for a Digital Ocean Spaces file
 * @param storageKey - The path to the file in Spaces (e.g., "videos/sample-lesson.mp4")
 * @param expiresInMinutes - How long the URL should be valid (default: 60 minutes)
 * @returns The signed URL that can be used to access the file
 */
export async function getSignedUrl(
  storageKey: string,
  expiresInMinutes: number = 60
): Promise<string> {
  try {
    const bucketName = process.env.DO_SPACES_BUCKET!;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });

    // Generate signed URL
    const url = await getS3SignedUrl(s3Client, command, {
      expiresIn: expiresInMinutes * 60, // Convert minutes to seconds
    });

    return url;
  } catch (error: any) {
    console.error("Error generating signed URL:", error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Generate signed URLs for multiple files
 * @param storageKeys - Array of storage keys
 * @param expiresInMinutes - How long the URLs should be valid (default: 60 minutes)
 * @returns Array of signed URLs in the same order as input
 */
export async function getSignedUrls(
  storageKeys: string[],
  expiresInMinutes: number = 60
): Promise<string[]> {
  try {
    const signedUrlPromises = storageKeys.map((key) => getSignedUrl(key, expiresInMinutes));
    return await Promise.all(signedUrlPromises);
  } catch (error: any) {
    console.error("Error generating signed URLs:", error);
    throw new Error(`Failed to generate signed URLs: ${error.message}`);
  }
}
