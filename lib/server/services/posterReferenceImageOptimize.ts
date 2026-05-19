import { Buffer } from "node:buffer";
import sharp from "sharp";
import { logger } from "../logger";

/** Skip resize when uploads are already small enough for OpenAI reference/edit. */
const SKIP_BELOW_BYTES = 200_000;
const DEFAULT_MAX_PX = 1024;

/**
 * Downscale large logo/doctor/poster uploads before OpenAI `images.edit`.
 * Cuts upload time and request size without changing the image model.
 */
export async function optimizeImageForOpenAiUpload(
  base64: string,
  mimeType: string,
  label: string
): Promise<{ base64: string; mimeType: string }> {
  const maxPx = Number(process.env.OPENAI_REF_IMAGE_MAX_PX) || DEFAULT_MAX_PX;
  if (!Number.isFinite(maxPx) || maxPx < 256) {
    return { base64, mimeType };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { base64, mimeType };
  }

  if (buf.length <= SKIP_BELOW_BYTES) {
    return { base64, mimeType };
  }

  try {
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize(Math.round(maxPx), Math.round(maxPx), {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();

    if (out.length >= buf.length * 0.92) {
      return { base64, mimeType };
    }

    logger.info("Optimized image before OpenAI upload", {
      label,
      beforeBytes: buf.length,
      afterBytes: out.length,
      maxPx,
    });

    return { base64: out.toString("base64"), mimeType: "image/jpeg" };
  } catch (err) {
    logger.warn("Reference image optimize skipped", {
      label,
      error: err instanceof Error ? err.message : String(err),
    });
    return { base64, mimeType };
  }
}
