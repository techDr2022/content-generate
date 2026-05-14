import { Buffer } from "node:buffer";
import { POSTER_BRAND_IMAGE_MAX_BYTES, POSTER_BRAND_IMAGE_MAX_CHARS } from "@/lib/types";
import { HttpError } from "@/lib/server/http";

/** Strip optional `data:*;base64,` prefix and whitespace. */
export function stripDataUrlBase64(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  const m = /^data:[^;]+;base64,(.+)$/i.exec(t);
  return (m ? m[1] : t).replace(/\s/g, "");
}

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function normalizeMime(m: string | undefined): string | undefined {
  if (!m?.trim()) return undefined;
  const x = m.trim().toLowerCase();
  if (x === "image/jpg") return "image/jpeg";
  return x;
}

function assertImagePair(
  label: string,
  b64: string | undefined,
  mimeRaw: string | undefined
): void {
  const mime = normalizeMime(mimeRaw);
  if (b64 && !mime) {
    throw new HttpError(400, `${label}: add a MIME type for the uploaded image.`);
  }
  if (mime && !b64) {
    throw new HttpError(400, `${label}: image data is missing.`);
  }
  if (!mime && !b64) return;
  if (!ALLOWED_MIME.has(mime!)) {
    throw new HttpError(400, `${label}: use PNG, JPEG, or WebP.`);
  }
  let len: number;
  try {
    len = Buffer.from(b64!, "base64").length;
  } catch {
    throw new HttpError(400, `${label}: invalid base64 image data.`);
  }
  if (len > POSTER_BRAND_IMAGE_MAX_BYTES) {
    throw new HttpError(
      400,
      `${label}: image is too large (max ${Math.round(POSTER_BRAND_IMAGE_MAX_BYTES / (1024 * 1024))} MB decoded).`
    );
  }
  if (b64!.length > POSTER_BRAND_IMAGE_MAX_CHARS) {
    throw new HttpError(400, `${label}: image payload is too large.`);
  }
}

export function assertPosterBrandAssetsValid(input: {
  logoBase64?: string;
  logoMimeType?: string;
  doctorPhotoBase64?: string;
  doctorPhotoMimeType?: string;
}): { logoBase64?: string; logoMimeType?: string; doctorPhotoBase64?: string; doctorPhotoMimeType?: string } {
  const logoBase64 = stripDataUrlBase64(input.logoBase64);
  const doctorPhotoBase64 = stripDataUrlBase64(input.doctorPhotoBase64);
  const logoMimeType = normalizeMime(input.logoMimeType);
  const doctorPhotoMimeType = normalizeMime(input.doctorPhotoMimeType);

  assertImagePair("Logo", logoBase64, logoMimeType);
  assertImagePair("Doctor photo", doctorPhotoBase64, doctorPhotoMimeType);

  return {
    logoBase64,
    logoMimeType,
    doctorPhotoBase64,
    doctorPhotoMimeType,
  };
}
