import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./s3Client";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";


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
    const bucketName = process.env.DO_BUCKET!;

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

/**
 * Generate a signed URL for uploading a file to Digital Ocean Spaces
 * @param key - The path where the file will be stored
 * @param contentType - The MIME type of the file
 * @param expiresInSeconds - How long the URL should be valid (default: 600 seconds)
 * @returns Object containing the signed upload URL and the public URL
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 600
): Promise<{ uploadUrl: string; publicUrl: string }> {
  try {
    const bucketName = process.env.DO_BUCKET!;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      ACL: "public-read",
    });

    const uploadUrl = await getS3SignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    // Construct the public URL
    // Format: https://bucket-name.region.digitaloceanspaces.com/key
    const publicUrl = `https://${bucketName}.blr1.digitaloceanspaces.com/${key}`;

    return { uploadUrl, publicUrl };
  } catch (error: any) {
    console.error("Error generating upload URL:", error);
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}


export function extractKeyFromUrl(url: string) {
  const { pathname } = new URL(url);
  return pathname.startsWith("/") ? pathname.slice(1) : pathname;
}

export function extractTranscodeVideoFolderUrl(url: string) {
  const return_url = url.split("/").slice(1, -1).join("/") + '/';
  return return_url
}



export async function listAllKeys(prefix: string) {
  let keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: process.env.DO_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    keys.push(...(res.Contents?.map(o => o.Key!) || []));
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return keys;
}



export async function deleteFolder(prefix: string) {
  try {
    const keys = await listAllKeys(prefix);

    if (!keys.length) return;

    const BATCH_SIZE = 500;

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.DO_BUCKET,
          Delete: {
            Objects: batch.map(Key => ({ Key })),
            Quiet: false,
          },
        })
      );
    }

  } catch (error) {
    console.log("error while deleting folder ==> ", error)
  }
}


// /transcoded/1768553561485_your_name/master.m3u8



export async function deleteFromDO(key: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.DO_BUCKET,
      Key: key,
    })
  );
}