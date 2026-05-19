import type OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Buffer } from "node:buffer";
import type {
  ClientBrandKit,
  PosterBrandAssetsPayload,
  PosterImageFormatId,
  PosterImageQualityId,
  PosterImageSizeId,
  PosterImageOutputOptions,
  PosterLookId,
} from "@/lib/types";
import { POSTER_LOOK_HINTS } from "@/lib/types";
import { buildPosterLayoutForPrompt } from "@/lib/posterLayout";
import { formatBrandKitForImagePrompt } from "./brandKitPrompt";
import { logger } from "../logger";
import {
  estimateOpenAiImageCostUsd,
  type OpenAiImageOperation,
} from "./openaiImagePricing";
import { getOpenAiClient } from "./openaiClient";
import { optimizeImageForOpenAiUpload } from "./posterReferenceImageOptimize";

export type PosterImageUsage = {
  operation: OpenAiImageOperation;
  model: string;
  size: string;
  quality: string;
  costUsd: number;
};

export type PosterImageResult = {
  b64: string;
  mimeType: string;
  revisedPrompt?: string;
  usage: PosterImageUsage;
};

/** DALL·E 3 prompt max length */
const MAX_PROMPT_CHARS = 4000;
/** GPT image `images.edit` prompt budget */
const MAX_EDIT_PROMPT_CHARS = 32000;

/** Applied to every generation so posters stay appropriate for healthcare brands. */
const HEALTHCARE_POSTER_BASELINE = `Professional healthcare marketing poster for hospitals, clinics, or medical practices: trustworthy, dignified, patient-appropriate visuals. Educational and inviting tone; avoid graphic anatomy, gore, sensationalism, fear-based messaging, or implied guarantees of outcomes.`;

function resolveLookHint(posterLook: PosterLookId, posterLookCustom?: string): string {
  if (posterLook === "custom") {
    return (posterLookCustom ?? "").trim();
  }
  return POSTER_LOOK_HINTS[posterLook];
}

/**
 * Image prompt = healthcare baseline + optional look hint + calendar **text in image** copy
 * (+ optional contact lines for typography on the poster).
 */
export function buildPosterImagePrompt(input: {
  textInImage: string;
  posterLook: PosterLookId;
  posterLookCustom?: string;
  contactDetails?: string;
  brandKit?: ClientBrandKit | null;
  /** Calendar content style (e.g. Myth vs Fact) — hints layout variety. */
  contentStyle?: string;
  /** Resolved header block (doctor / clinic line). */
  headerBlock?: string;
  /** Resolved footer block (contact, address). */
  footerBlock?: string;
  /** Featured doctor for this poster (portrait / header attribution). */
  featuredDoctor?: string;
  generationNotes?: string;
}): string {
  const hint = resolveLookHint(input.posterLook, input.posterLookCustom);
  const brandBlock = formatBrandKitForImagePrompt(input.brandKit);
  const genNotes = input.generationNotes?.trim();
  const body = input.textInImage.trim();
  const contact = input.contactDetails?.trim();
  const styleHint = input.contentStyle?.trim();
  const sep = "\n\n";

  const segments: string[] = [HEALTHCARE_POSTER_BASELINE];
  if (brandBlock) segments.push(brandBlock);
  if (genNotes) {
    segments.push(`CLIENT GENERATION NOTES (follow for this poster):\n${genNotes}`);
  }
  if (hint) segments.push(hint);
  if (styleHint) {
    segments.push(
      `Content format: "${styleHint}" — choose a layout that fits this format (e.g. split panels for Myth vs Fact, checklist for Dos & Don'ts).`
    );
  }

  const header = input.headerBlock?.trim();
  const footer = input.footerBlock?.trim() ?? contact;
  const doctor = input.featuredDoctor?.trim();

  if (header || doctor) {
    const headerLines = [
      "POSTER HEADER (top area — clear hierarchy, readable typography):",
      ...(header ? [header] : []),
      ...(doctor && !header?.includes(doctor)
        ? [`Feature this doctor prominently in the header or portrait area: ${doctor}`]
        : []),
    ];
    segments.push(headerLines.join("\n"));
  }

  segments.push(`MAIN CONTENT (center — render this text faithfully):\n${body}`);

  if (footer) {
    segments.push(
      `POSTER FOOTER (bottom — consistent on every creative; preserve wording):\n${footer}`
    );
  }

  let combined = segments.join(sep);
  if (combined.length <= MAX_PROMPT_CHARS) return combined;

  const baselineLen = HEALTHCARE_POSTER_BASELINE.length;
  const sepLen = sep.length;

  let hintPart = hint;
  let bodyPart = body;
  let contactPart = footer ?? "";
  const headerPart = header ?? "";

  if (hintPart) {
    while (
      combined.length > MAX_PROMPT_CHARS &&
      hintPart.length > 80
    ) {
      hintPart = `${hintPart.slice(0, Math.floor(hintPart.length * 0.85))}…`;
      combined = [HEALTHCARE_POSTER_BASELINE, hintPart, bodyPart, contactPart ? contactPart : ""]
        .filter(Boolean)
        .join(sep);
    }
  }

  if (contactPart) {
    while (combined.length > MAX_PROMPT_CHARS && contactPart.length > 60) {
      contactPart = `${contactPart.slice(0, Math.floor(contactPart.length * 0.88))}…`;
      combined = hintPart
        ? [HEALTHCARE_POSTER_BASELINE, hintPart, bodyPart, contactPart].join(sep)
        : [HEALTHCARE_POSTER_BASELINE, bodyPart, contactPart].join(sep);
    }
  }

  const overhead =
    baselineLen +
    sepLen +
    (hintPart ? hintPart.length + sepLen : 0) +
    (headerPart ? headerPart.length + sepLen + 40 : 0) +
    (contactPart ? contactPart.length + sepLen + 40 : 0);
  let bodyBudget = MAX_PROMPT_CHARS - overhead;
  if (bodyBudget < 40) bodyBudget = 40;

  if (bodyPart.length > bodyBudget) {
    bodyPart = `${bodyPart.slice(0, Math.max(0, bodyBudget - 1))}…`;
  }

  combined = hintPart
    ? [HEALTHCARE_POSTER_BASELINE, hintPart, bodyPart, contactPart].filter(Boolean).join(sep)
    : [HEALTHCARE_POSTER_BASELINE, bodyPart, contactPart].filter(Boolean).join(sep);

  return combined.slice(0, MAX_PROMPT_CHARS);
}

function imageModel(): string {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (raw) return raw;
  return "dall-e-3";
}

/**
 * When using reference images, `images.edit` requires a GPT image model (not DALL·E 3).
 * `input_fidelity` is only valid on some of those models (e.g. gpt-image-1 / 1.5); gpt-image-1-mini and
 * gpt-image-2 return 400 if it is sent.
 */
function supportsInputFidelityParameter(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (!m.startsWith("gpt-image-")) return false;
  if (m.includes("mini")) return false;
  if (m.startsWith("gpt-image-2")) return false;
  return m.startsWith("gpt-image-1");
}

function imageEditModel(): string {
  const primary = process.env.OPENAI_IMAGE_MODEL?.trim() ?? "";
  if (primary && /^gpt-image-/i.test(primary)) return primary;
  const edit = process.env.OPENAI_IMAGE_EDIT_MODEL?.trim();
  if (edit) return edit;
  return "gpt-image-1.5";
}

/** High input fidelity is slow; only use when the user explicitly asks for high quality. */
function resolveInputFidelity(
  model: string,
  quality?: PosterImageQualityId
): "high" | undefined {
  if (quality !== "high") return undefined;
  return supportsInputFidelityParameter(model) ? "high" : undefined;
}

const PRESET_POSTER_SIZES = ["1024x1024", "1024x1792", "1792x1024"] as const;
type PresetPosterSize = (typeof PRESET_POSTER_SIZES)[number];

function isCustomPixelSize(value: string): boolean {
  return /^\d+x\d+$/.test(value);
}

function imageSizeFromEnv(): PresetPosterSize | string {
  const raw = process.env.OPENAI_IMAGE_SIZE?.trim().toLowerCase();
  if (!raw) return "1024x1024";
  if (raw === "1024x1792" || raw === "1792x1024" || raw === "1024x1024") return raw;
  if (isCustomPixelSize(raw)) return raw;
  return "1024x1024";
}

function resolveDalleStylePosterSize(requested?: PosterImageSizeId): PresetPosterSize | string {
  if (requested === "1024x1792" || requested === "1792x1024" || requested === "1024x1024") {
    return requested;
  }
  return imageSizeFromEnv();
}

function isDalleImageModel(model: string): boolean {
  return /^dall-e-/i.test(model.trim());
}

function effectiveGenerateSize(model: string, requested: PresetPosterSize | string): string {
  if (isDalleImageModel(model)) {
    if (requested === "1024x1792" || requested === "1792x1024" || requested === "1024x1024") {
      return requested;
    }
    return "1024x1024";
  }
  if (typeof requested === "string" && isCustomPixelSize(requested)) {
    return requested;
  }
  switch (requested) {
    case "1024x1792":
      return "1024x1536";
    case "1792x1024":
      return "1536x1024";
    default:
      return "1024x1024";
  }
}

function mapQualityForOpenAI(
  model: string,
  q?: PosterImageQualityId
): "standard" | "hd" | "low" | "medium" | "high" | "auto" {
  const chosen = q ?? "auto";
  if (isDalleImageModel(model)) {
    if (/^dall-e-3$/i.test(model.trim())) {
      return chosen === "high" ? "hd" : "standard";
    }
    return "standard";
  }
  return chosen;
}

function mapGptQualityForEdit(q?: PosterImageQualityId): "auto" | "low" | "medium" | "high" {
  const v = q ?? "auto";
  if (v === "low" || v === "medium" || v === "high" || v === "auto") return v;
  return "auto";
}

function mimeFromOutputFormat(out: { output_format?: string | null }, fallback: PosterImageFormatId | "png"): string {
  const fmt = out.output_format ?? fallback;
  if (fmt === "webp") return "image/webp";
  if (fmt === "jpeg") return "image/jpeg";
  return "image/png";
}

function uploadFilenameForMime(mime: string, label: string): string {
  if (mime.includes("webp")) return `${label}.webp`;
  if (mime.includes("png")) return `${label}.png`;
  return `${label}.jpg`;
}

function buildEditPromptWithReferences(
  posterPrompt: string,
  hasLogo: boolean,
  hasDoctor: boolean
): string {
  let pre = "";
  if (hasLogo && hasDoctor) {
    pre = `Create a new professional healthcare marketing poster layout.

The first attached image is the official CLINIC LOGO—integrate it cleanly (for example header or footer), preserve brand colors and legibility.

The second attached image is the DOCTOR'S PORTRAIT—use respectfully as a portrait element; preserve facial likeness; blend lighting with the poster.

Follow all creative direction in the prompt below.

`;
  } else if (hasLogo) {
    pre = `Create a new professional healthcare marketing poster layout.

The attached image is the official CLINIC LOGO—integrate it cleanly; preserve branding.

Follow all creative direction in the prompt below.

`;
  } else {
    pre = `Create a new professional healthcare marketing poster layout.

The attached image is the DOCTOR'S PORTRAIT—use as a tasteful portrait element; preserve likeness.

Follow all creative direction in the prompt below.

`;
  }
  const combined = pre + posterPrompt;
  if (combined.length <= MAX_EDIT_PROMPT_CHARS) return combined;
  return `${combined.slice(0, MAX_EDIT_PROMPT_CHARS - 1)}…`;
}

export type PosterGenerateInput = {
  textInImage: string;
  posterLook: PosterLookId;
  posterLookCustom?: string;
  brandKit?: ClientBrandKit | null;
  contentStyle?: string;
  featuredDoctor?: string;
  clinicName?: string;
  city?: string;
  generationNotes?: string;
} & PosterImageOutputOptions &
  PosterBrandAssetsPayload;

export type PosterRefineInput = {
  imageBase64: string;
  imageMimeType: string;
  editInstruction: string;
  brandKit?: ClientBrandKit | null;
} & PosterImageOutputOptions;

function buildUsage(
  operation: OpenAiImageOperation,
  model: string,
  size: string,
  quality: string,
  input: { imageQuality?: PosterImageQualityId; referenceImageCount?: number }
): PosterImageUsage {
  const costUsd = estimateOpenAiImageCostUsd({
    model,
    operation,
    size,
    quality: input.imageQuality,
    referenceImageCount: input.referenceImageCount,
  });
  return { operation, model, size, quality, costUsd };
}

async function referenceImageFile(
  base64: string,
  mimeType: string,
  label: string,
  uploadName: string
): Promise<Awaited<ReturnType<typeof toFile>>> {
  const optimized = await optimizeImageForOpenAiUpload(base64, mimeType, label);
  return toFile(
    Buffer.from(optimized.base64, "base64"),
    uploadFilenameForMime(optimized.mimeType, uploadName),
    { type: optimized.mimeType }
  );
}

export async function generatePosterImageFromText(
  input: PosterGenerateInput
): Promise<PosterImageResult> {
  const client = getOpenAiClient();
  const contact = input.contactDetails?.trim();
  const hasLogo = Boolean(input.logoBase64?.trim() && input.logoMimeType);
  const hasDoctor = Boolean(input.doctorPhotoBase64?.trim() && input.doctorPhotoMimeType);
  const hasRefs = hasLogo || hasDoctor;

  const layoutCtx = {
    doctorName: input.featuredDoctor?.trim() ?? "",
    clinicName: input.clinicName?.trim() ?? "",
    city: input.city?.trim() ?? "",
  };
  const layout = buildPosterLayoutForPrompt({
    brandKit: input.brandKit,
    ctx: layoutCtx,
    extraContactDetails: contact,
  });

  const posterPrompt = buildPosterImagePrompt({
    textInImage: input.textInImage,
    posterLook: input.posterLook,
    posterLookCustom: input.posterLookCustom,
    brandKit: input.brandKit,
    contentStyle: input.contentStyle,
    headerBlock: layout.headerBlock,
    footerBlock: layout.footerBlock,
    featuredDoctor: input.featuredDoctor,
    generationNotes: input.generationNotes,
  });

  if (hasRefs) {
    return generatePosterWithReferenceImages(client, input, posterPrompt, { hasLogo, hasDoctor });
  }

  const model = imageModel();
  const sizeRequested = resolveDalleStylePosterSize(input.imageSize);
  const size = effectiveGenerateSize(model, sizeRequested);
  const quality = mapQualityForOpenAI(model, input.imageQuality);
  const dalle = isDalleImageModel(model);
  const outputFormat = input.outputFormat ?? "png";
  const background = input.background ?? "auto";
  const compression =
    typeof input.outputCompression === "number" && !Number.isNaN(input.outputCompression)
      ? Math.min(100, Math.max(0, Math.round(input.outputCompression)))
      : 100;

  logger.info("OpenAI image generation starting", {
    mode: "generate",
    model,
    sizeRequested,
    sizeEffective: size,
    promptChars: posterPrompt.length,
    quality,
    outputFormat: dalle ? undefined : outputFormat,
    outputCompression: dalle || outputFormat === "png" ? undefined : compression,
    background: dalle ? undefined : background,
  });

  const base = {
    model,
    prompt: posterPrompt,
    n: 1,
    size: size as "1024x1024" | "1024x1792" | "1792x1024" | "1024x1536" | "1536x1024",
    quality,
  };

  const response = await client.images.generate(
    dalle
      ? {
          ...base,
          response_format: "b64_json" as const,
        }
      : {
          ...base,
          output_format: outputFormat,
          background,
          ...(outputFormat === "jpeg" || outputFormat === "webp" ? { output_compression: compression } : {}),
        }
  );

  const item = response.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  const mimeFallback: PosterImageFormatId | "png" = dalle ? "png" : outputFormat;

  const qualityStr = String(quality);
  return {
    b64,
    mimeType: mimeFromOutputFormat(response, mimeFallback),
    revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
    usage: buildUsage("generate", model, size, qualityStr, input),
  };
}

async function generatePosterWithReferenceImages(
  client: OpenAI,
  input: PosterGenerateInput,
  posterPrompt: string,
  flags: { hasLogo: boolean; hasDoctor: boolean }
): Promise<PosterImageResult> {
  const { hasLogo, hasDoctor } = flags;
  const editModel = imageEditModel();
  const sizeRequested = resolveDalleStylePosterSize(input.imageSize);
  const size = effectiveGenerateSize(editModel, sizeRequested);
  const outputFormat = input.outputFormat ?? "png";
  const background = input.background ?? "auto";
  const compression =
    typeof input.outputCompression === "number" && !Number.isNaN(input.outputCompression)
      ? Math.min(100, Math.max(0, Math.round(input.outputCompression)))
      : 100;
  const editQuality = mapGptQualityForEdit(input.imageQuality);

  const filePromises: Promise<Awaited<ReturnType<typeof toFile>>>[] = [];
  if (hasLogo && input.logoBase64 && input.logoMimeType) {
    filePromises.push(referenceImageFile(input.logoBase64, input.logoMimeType, "logo", "logo"));
  }
  if (hasDoctor && input.doctorPhotoBase64 && input.doctorPhotoMimeType) {
    filePromises.push(
      referenceImageFile(input.doctorPhotoBase64, input.doctorPhotoMimeType, "doctor", "doctor")
    );
  }
  const files = await Promise.all(filePromises);

  if (files.length === 0) {
    throw new Error("Reference image upload was empty");
  }

  const prompt = buildEditPromptWithReferences(posterPrompt, hasLogo, hasDoctor);
  const inputFidelity = resolveInputFidelity(editModel, input.imageQuality);

  logger.info("OpenAI image edit starting", {
    mode: "edit",
    model: editModel,
    sizeRequested,
    sizeEffective: size,
    promptChars: prompt.length,
    quality: editQuality,
    outputFormat,
    outputCompression: outputFormat === "png" ? undefined : compression,
    background,
    referenceCount: files.length,
    inputFidelity: inputFidelity ?? "omitted",
  });

  const response = await client.images.edit({
    model: editModel,
    image: files.length === 1 ? files[0]! : files,
    prompt,
    n: 1,
    size: size as "1024x1024" | "1024x1536" | "1536x1024",
    quality: editQuality,
    output_format: outputFormat,
    background,
    ...(outputFormat === "jpeg" || outputFormat === "webp" ? { output_compression: compression } : {}),
    ...(inputFidelity ? { input_fidelity: inputFidelity } : {}),
  });

  const item = response.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  const refCount = (hasLogo ? 1 : 0) + (hasDoctor ? 1 : 0);
  return {
    b64,
    mimeType: mimeFromOutputFormat(response, outputFormat),
    revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
    usage: buildUsage("edit", editModel, size, editQuality, {
      ...input,
      referenceImageCount: refCount,
    }),
  };
}

/**
 * Edit an existing poster: remove or replace elements per user instruction (OpenAI image edit).
 */
export async function refinePosterImage(
  input: PosterRefineInput
): Promise<PosterImageResult> {
  const instruction = input.editInstruction.trim();
  if (!instruction) {
    throw new Error("editInstruction is required");
  }

  const client = getOpenAiClient();
  const editModel = imageEditModel();
  const sizeRequested = resolveDalleStylePosterSize(input.imageSize);
  const size = effectiveGenerateSize(editModel, sizeRequested);
  const outputFormat = input.outputFormat ?? "png";
  const background = input.background ?? "auto";
  const compression =
    typeof input.outputCompression === "number" && !Number.isNaN(input.outputCompression)
      ? Math.min(100, Math.max(0, Math.round(input.outputCompression)))
      : 100;
  const editQuality = mapGptQualityForEdit(input.imageQuality);
  const brandBlock = formatBrandKitForImagePrompt(input.brandKit);

  const file = await referenceImageFile(
    input.imageBase64,
    input.imageMimeType,
    "poster-refine",
    "poster"
  );

  let prompt = `Edit this healthcare marketing poster image.

User change request (apply precisely): ${instruction}

Preserve all text that was not mentioned in the change request. Keep the poster professional and on-brand for a medical practice.`;

  if (brandBlock) {
    prompt += `\n\n${brandBlock}`;
  }

  if (prompt.length > MAX_EDIT_PROMPT_CHARS) {
    prompt = `${prompt.slice(0, MAX_EDIT_PROMPT_CHARS - 1)}…`;
  }

  const inputFidelity = resolveInputFidelity(editModel, input.imageQuality);

  logger.info("OpenAI poster refine starting", {
    mode: "refine",
    model: editModel,
    promptChars: prompt.length,
    editQuality,
    outputFormat,
  });

  const response = await client.images.edit({
    model: editModel,
    image: file,
    prompt,
    n: 1,
    size: size as "1024x1024" | "1024x1536" | "1536x1024",
    quality: editQuality,
    output_format: outputFormat,
    background,
    ...(outputFormat === "jpeg" || outputFormat === "webp" ? { output_compression: compression } : {}),
    ...(inputFidelity ? { input_fidelity: inputFidelity } : {}),
  });

  const item = response.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  return {
    b64,
    mimeType: mimeFromOutputFormat(response, outputFormat),
    revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
    usage: buildUsage("refine", editModel, size, editQuality, input),
  };
}
