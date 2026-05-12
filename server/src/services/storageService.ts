import fs from "fs";
import path from "path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/s3";
import { logger } from "../lib/logger";

/** Avoid opaque SDK errors when `.env` still has example R2 placeholders (wrong length / invalid). */
function assertS3CredentialsReady(): void {
  const ak = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const sk = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
  if (!ak || !sk) {
    throw new Error(
      "STORAGE_TYPE=S3 requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY. For local dev without object storage, set STORAGE_TYPE=LOCAL."
    );
  }
  const looksPlaceholder =
    ak.startsWith("your_") ||
    sk.startsWith("your_") ||
    /^your/i.test(ak) ||
    /^your/i.test(sk) ||
    ak.includes("xxxx") ||
    sk.includes("xxxx");
  if (looksPlaceholder) {
    throw new Error(
      "S3 credentials look like placeholders. Create an R2 API token (Cloudflare dashboard → R2 → Manage R2 API Tokens): use the Access Key ID (32 chars) and Secret Access Key. Or set STORAGE_TYPE=LOCAL to save files under ./uploads."
    );
  }
}

export async function persistWorkbookForJob(jobId: string, workbookBuffer: Buffer): Promise<string> {
  const storageType = process.env.STORAGE_TYPE ?? "LOCAL";

  if (storageType === "S3") {
    return uploadToS3(jobId, workbookBuffer);
  }

  return saveLocal(jobId, workbookBuffer);
}

async function saveLocal(jobId: string, workbookBuffer: Buffer): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_PATH ?? "./uploads";
  const absDir = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir);
  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }
  const dest = path.join(absDir, `${jobId}.xlsx`);
  await fs.promises.writeFile(dest, workbookBuffer);

  const publicBase =
    process.env.PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;
  const fileUrl = `${publicBase.replace(/\/$/, "")}/api/jobs/${jobId}/download`;
  logger.info("Stored workbook locally", { jobId, dest, fileUrl });
  return fileUrl;
}

async function uploadToS3(jobId: string, workbookBuffer: Buffer): Promise<string> {
  assertS3CredentialsReady();
  const bucket = process.env.AWS_BUCKET_NAME;
  if (!bucket || /^your[-a-z]*$/i.test(bucket.trim())) {
    throw new Error(
      "Set AWS_BUCKET_NAME to your real R2 bucket name (not a placeholder). Or use STORAGE_TYPE=LOCAL."
    );
  }
  const key = `exports/${jobId}.xlsx`;
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: workbookBuffer,
      ContentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );

  const signed = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 }
  );
  return signed;
}

export function getLocalWorkbookPath(jobId: string): string {
  const baseDir = process.env.LOCAL_STORAGE_PATH ?? "./uploads";
  const absDir = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir);
  return path.join(absDir, `${jobId}.xlsx`);
}
