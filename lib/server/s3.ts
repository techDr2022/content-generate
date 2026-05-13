import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3-compatible client — AWS S3 or Cloudflare R2.
 *
 * R2: either set `S3_ENDPOINT` to the S3 API URL
 *   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
 * or set `R2_ACCOUNT_ID` (same value as in the Cloudflare dashboard) and we build that URL.
 */
export function getS3Client(): S3Client {
  const explicit = process.env.S3_ENDPOINT?.trim() || process.env.R2_ENDPOINT?.trim();
  const accountId =
    process.env.R2_ACCOUNT_ID?.trim() || process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const endpoint =
    explicit ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE === "true" ||
    process.env.S3_FORCE_PATH_STYLE === "1" ||
    (Boolean(endpoint) && process.env.S3_FORCE_PATH_STYLE !== "false");

  if (endpoint) {
    const region = process.env.AWS_REGION?.trim() || "auto";
    return new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  const region = process.env.AWS_REGION?.trim();
  if (!region) {
    throw new Error("AWS_REGION is required for S3 (or set S3_ENDPOINT for R2 / S3-compatible storage)");
  }

  return new S3Client({
    region,
    forcePathStyle,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}
