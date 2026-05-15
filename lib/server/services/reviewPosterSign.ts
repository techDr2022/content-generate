import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "@/lib/server/s3";

const MAX_TTL_SEC = 2 * 60 * 60;

/**
 * Presigned GET URL for a stored poster object, capped at 2 hours.
 */
export async function presignPosterObjectKey(objectKey: string | null | undefined): Promise<string | null> {
  if (!objectKey?.trim()) return null;
  const bucket = process.env.AWS_BUCKET_NAME?.trim();
  if (!bucket || (process.env.STORAGE_TYPE ?? "LOCAL") !== "S3") {
    return null;
  }
  try {
    const client = getS3Client();
    const signed = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey.trim() }),
      { expiresIn: MAX_TTL_SEC }
    );
    return signed;
  } catch {
    return null;
  }
}
