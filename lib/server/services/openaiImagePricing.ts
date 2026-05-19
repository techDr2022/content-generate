import type { PosterImageQualityId, PosterImageSizeId } from "@/lib/types";

export type OpenAiImageOperation = "generate" | "edit" | "refine";

/** Rough USD per image — used for dashboard estimates when OpenAI billing API is unavailable. */
export function estimateOpenAiImageCostUsd(input: {
  model: string;
  operation: OpenAiImageOperation;
  size?: PosterImageSizeId | string;
  quality?: PosterImageQualityId;
  referenceImageCount?: number;
}): number {
  const model = input.model.trim().toLowerCase();
  const quality = input.quality ?? "auto";
  const size = normalizeSizeKey(input.size);
  const refs = input.referenceImageCount ?? 0;

  if (/^dall-e-3$/i.test(model)) {
    const hd = quality === "high";
    if (size === "1024x1792" || size === "1792x1024") {
      return hd ? 0.12 : 0.08;
    }
    return hd ? 0.08 : 0.04;
  }

  if (/^dall-e-2$/i.test(model)) {
    return size === "1024x1024" ? 0.02 : 0.018;
  }

  if (model.startsWith("gpt-image-")) {
    const q = mapGptQuality(quality);
    const base = gptImageSquareUsd(model, q);
    if (input.operation === "edit" || input.operation === "refine") {
      return base * (1 + Math.min(refs, 2) * 0.15);
    }
    return base;
  }

  return 0.06;
}

function mapGptQuality(q: PosterImageQualityId): "low" | "medium" | "high" {
  if (q === "low" || q === "medium" || q === "high") return q;
  return "medium";
}

function normalizeSizeKey(size?: string): string {
  const s = (size ?? "1024x1024").toLowerCase();
  if (s === "1024x1536" || s === "1024x1792") return "1024x1792";
  if (s === "1536x1024" || s === "1792x1024") return "1792x1024";
  return "1024x1024";
}

/** Per-image USD for square output; portrait/landscape scaled ~1.25×. */
function gptImageSquareUsd(model: string, quality: "low" | "medium" | "high"): number {
  const is15 = model.includes("1.5") || model.includes("1-5");
  const table = is15
    ? { low: 0.009, medium: 0.034, high: 0.13 }
    : { low: 0.011, medium: 0.042, high: 0.167 };
  return table[quality];
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
