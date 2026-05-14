import fs from "fs";
import path from "path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../s3";
import { logger } from "../logger";
import { HttpError } from "../http";

/** Avoid opaque SDK errors when `.env` still has example R2 placeholders (wrong length / invalid). */
function assertS3CredentialsReady(): void {
  const ak = process.env.AWS_ACCESS_KEY_ID?.trim() ?? "";
  const sk = process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "";
  if (!ak || !sk) {
    const missing = [!ak && "AWS_ACCESS_KEY_ID", !sk && "AWS_SECRET_ACCESS_KEY"].filter(Boolean).join(" and ");
    throw new Error(
      `STORAGE_TYPE=S3 requires both credentials; missing ${missing}. R2 tokens list Access Key ID + Secret. For laptop-only dev, set STORAGE_TYPE=LOCAL.`
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

/**
 * Directory where LOCAL workbooks are stored. Worker and Next must resolve the same path.
 * Prefer `LOCAL_STORAGE_ABSOLUTE_PATH` when the worker runs in a separate process.
 */
export function getUploadsRoot(): string {
  const absoluteOverride = process.env.LOCAL_STORAGE_ABSOLUTE_PATH?.trim();
  if (absoluteOverride) {
    return path.resolve(absoluteOverride);
  }
  const rel = process.env.LOCAL_STORAGE_PATH?.trim() ?? "./uploads";
  if (path.isAbsolute(rel)) {
    return path.normalize(rel);
  }
  return path.resolve(process.cwd(), rel);
}

export async function persistWorkbookForJob(jobId: string, workbookBuffer: Buffer): Promise<string> {
  const storageType = process.env.STORAGE_TYPE ?? "LOCAL";

  if (storageType === "S3") {
    return uploadToS3(jobId, workbookBuffer);
  }

  return saveLocal(jobId, workbookBuffer);
}

function publicAppBase(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

async function saveLocal(jobId: string, workbookBuffer: Buffer): Promise<string> {
  const absDir = getUploadsRoot();
  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }
  const dest = path.join(absDir, `${jobId}.xlsx`);
  await fs.promises.writeFile(dest, workbookBuffer);

  const publicBase = publicAppBase();
  const fileUrl = `${publicBase.replace(/\/$/, "")}/api/jobs/${jobId}/download`;
  logger.info("Stored workbook locally", { jobId, dest, uploadsRoot: absDir, fileUrl });
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
  return path.join(getUploadsRoot(), `${jobId}.xlsx`);
}

function isSameOriginApiDownloadUrl(fileUrl: string): boolean {
  try {
    const u = new URL(fileUrl);
    return u.pathname.includes("/api/jobs/") && u.pathname.includes("/download");
  } catch {
    return false;
  }
}

/**
 * Load workbook bytes: local disk first, then HTTP (S3 presigned / R2) when configured.
 */
export async function loadWorkbookBufferForJob(job: {
  id: string;
  fileUrl: string | null;
}): Promise<Buffer> {
  const storage = process.env.STORAGE_TYPE ?? "LOCAL";
  const localPath = getLocalWorkbookPath(job.id);

  if (fs.existsSync(localPath)) {
    return fs.promises.readFile(localPath);
  }

  const url = job.fileUrl?.trim() ?? "";
  const canFetchRemote =
    url.startsWith("http") &&
    (storage !== "LOCAL" || !isSameOriginApiDownloadUrl(url));

  if (canFetchRemote) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new HttpError(502, `Could not fetch workbook from storage (HTTP ${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const root = getUploadsRoot();
  throw new HttpError(
    404,
    `Workbook not found on disk at ${localPath}. Uploads root is ${root} (cwd=${process.cwd()}). ` +
      `If you use \`npm run worker\` in another terminal, load the same env: add dotenv at the top of the worker script ` +
      `or set LOCAL_STORAGE_ABSOLUTE_PATH to an absolute folder both processes use. For cloud deploys without a shared disk, use STORAGE_TYPE=S3.`
  );
}
