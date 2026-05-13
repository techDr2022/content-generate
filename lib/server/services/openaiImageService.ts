import OpenAI from "openai";
import type { PosterLookId } from "@/lib/types";
import { POSTER_LOOK_HINTS } from "@/lib/types";
import { logger } from "../logger";

/** DALL·E 3 prompt max length */
const MAX_PROMPT_CHARS = 4000;

/** Applied to every generation so posters stay appropriate for healthcare brands. */
const HEALTHCARE_POSTER_BASELINE = `Professional healthcare marketing poster for hospitals, clinics, or medical practices: trustworthy, dignified, patient-appropriate visuals. Educational and inviting tone; avoid graphic anatomy, gore, sensationalism, fear-based messaging, or implied guarantees of outcomes.`;

function resolveLookHint(posterLook: PosterLookId, posterLookCustom?: string): string {
  if (posterLook === "custom") {
    return (posterLookCustom ?? "").trim();
  }
  return POSTER_LOOK_HINTS[posterLook];
}

/**
 * Image prompt = healthcare baseline + optional look hint + calendar **text in image** copy.
 * The baseline enforces professional healthcare suitability on every run.
 */
export function buildPosterImagePrompt(input: {
  textInImage: string;
  posterLook: PosterLookId;
  posterLookCustom?: string;
}): string {
  const hint = resolveLookHint(input.posterLook, input.posterLookCustom);
  const body = input.textInImage.trim();
  const sep = "\n\n";

  const segments: string[] = [HEALTHCARE_POSTER_BASELINE];
  if (hint) segments.push(hint);
  segments.push(body);

  let combined = segments.join(sep);
  if (combined.length <= MAX_PROMPT_CHARS) return combined;

  const baselineLen = HEALTHCARE_POSTER_BASELINE.length;
  const sepLen = sep.length;

  let hintPart = hint;
  let bodyPart = body;

  if (hintPart) {
    while (
      combined.length > MAX_PROMPT_CHARS &&
      hintPart.length > 80
    ) {
      hintPart = `${hintPart.slice(0, Math.floor(hintPart.length * 0.85))}…`;
      combined = [HEALTHCARE_POSTER_BASELINE, hintPart, bodyPart].join(sep);
    }
  }

  const overhead =
    baselineLen + sepLen + (hintPart ? hintPart.length + sepLen : 0);
  let bodyBudget = MAX_PROMPT_CHARS - overhead;
  if (bodyBudget < 40) bodyBudget = 40;

  if (bodyPart.length > bodyBudget) {
    bodyPart = `${bodyPart.slice(0, Math.max(0, bodyBudget - 1))}…`;
  }

  combined = hintPart
    ? [HEALTHCARE_POSTER_BASELINE, hintPart, bodyPart].join(sep)
    : [HEALTHCARE_POSTER_BASELINE, bodyPart].join(sep);

  return combined.slice(0, MAX_PROMPT_CHARS);
}

function imageModel(): string {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (raw) return raw;
  return "dall-e-3";
}

function imageSize(): "1024x1024" | "1024x1792" | "1792x1024" {
  const raw = process.env.OPENAI_IMAGE_SIZE?.trim().toLowerCase();
  if (raw === "1024x1792" || raw === "1792x1024" || raw === "1024x1024") {
    return raw;
  }
  return "1024x1024";
}

/** DALL·E 2/3 accept `response_format`; GPT image models reject it and always return base64 in `b64_json`. */
function isDalleImageModel(model: string): boolean {
  return /^dall-e-/i.test(model.trim());
}

/**
 * GPT image models use 1024×1536 / 1536×1024 instead of DALL·E 3’s 1024×1792 / 1792×1024.
 * See OpenAI Image API `size` for `gpt-image-*`.
 */
function effectiveGenerateSize(model: string, dallESize: ReturnType<typeof imageSize>): string {
  if (isDalleImageModel(model)) {
    return dallESize;
  }
  switch (dallESize) {
    case "1024x1792":
      return "1024x1536";
    case "1792x1024":
      return "1536x1024";
    default:
      return "1024x1024";
  }
}

function mimeFromImagesResponse(out: { output_format?: string | null }): string {
  const fmt = out.output_format;
  if (fmt === "webp") return "image/webp";
  if (fmt === "jpeg") return "image/jpeg";
  return "image/png";
}

export async function generatePosterImageFromText(input: {
  textInImage: string;
  posterLook: PosterLookId;
  posterLookCustom?: string;
}): Promise<{ b64: string; mimeType: string; revisedPrompt?: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  const model = imageModel();
  const prompt = buildPosterImagePrompt(input);
  const sizeRequested = imageSize();
  const size = effectiveGenerateSize(model, sizeRequested);

  logger.info("OpenAI image generation starting", {
    model,
    sizeRequested,
    sizeEffective: size,
    promptChars: prompt.length,
  });

  const response = await client.images.generate({
    model,
    prompt,
    n: 1,
    size: size as "1024x1024" | "1024x1792" | "1792x1024" | "1024x1536" | "1536x1024",
    ...(isDalleImageModel(model) ? { response_format: "b64_json" as const } : {}),
  });

  const item = response.data?.[0];
  const b64 = item?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  return {
    b64,
    mimeType: mimeFromImagesResponse(response),
    revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : undefined,
  };
}
