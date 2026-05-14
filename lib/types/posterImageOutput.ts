import type { PosterImageSizeId } from "./posterImageSize";

/** OpenAI GPT image models: `auto` lets the API pick. */
export const POSTER_IMAGE_QUALITY_IDS = ["auto", "low", "medium", "high"] as const;
export type PosterImageQualityId = (typeof POSTER_IMAGE_QUALITY_IDS)[number];

export const POSTER_IMAGE_QUALITY_LABELS: Record<PosterImageQualityId, string> = {
  auto: "Auto",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Returned bytes format for GPT image models (`output_format`). DALL·E always returns PNG in our flow. */
export const POSTER_IMAGE_FORMAT_IDS = ["png", "jpeg", "webp"] as const;
export type PosterImageFormatId = (typeof POSTER_IMAGE_FORMAT_IDS)[number];

export const POSTER_IMAGE_FORMAT_LABELS: Record<PosterImageFormatId, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
};

/** GPT image models only (`background`). */
export const POSTER_IMAGE_BACKGROUND_IDS = ["auto", "opaque"] as const;
export type PosterImageBackgroundId = (typeof POSTER_IMAGE_BACKGROUND_IDS)[number];

export const POSTER_IMAGE_BACKGROUND_LABELS: Record<PosterImageBackgroundId, string> = {
  auto: "Automatic",
  opaque: "Opaque",
};

/** Client payload for `/api/images/generate` output tuning (optional fields fall back to server defaults). */
export interface PosterImageOutputOptions {
  imageSize?: PosterImageSizeId;
  imageQuality?: PosterImageQualityId;
  outputFormat?: PosterImageFormatId;
  /** 0–100; used only for JPEG/WebP on GPT image models. */
  outputCompression?: number;
  background?: PosterImageBackgroundId;
}

/** Full UI state for poster output controls (every field sent on each generate). */
export interface PosterImageOutputState {
  imageSize: PosterImageSizeId;
  imageQuality: PosterImageQualityId;
  outputFormat: PosterImageFormatId;
  outputCompression: number;
  background: PosterImageBackgroundId;
}

export function defaultPosterImageOutputState(): PosterImageOutputState {
  return {
    imageSize: "1024x1024",
    imageQuality: "auto",
    outputFormat: "png",
    outputCompression: 100,
    background: "auto",
  };
}
