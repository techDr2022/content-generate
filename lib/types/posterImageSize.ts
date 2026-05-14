/** Output dimensions for poster image generation (DALL·E 3 naming; GPT image models are mapped on the server). */

export const POSTER_IMAGE_SIZE_IDS = ["1024x1024", "1024x1792", "1792x1024"] as const;

export type PosterImageSizeId = (typeof POSTER_IMAGE_SIZE_IDS)[number];

export const POSTER_IMAGE_SIZE_LABELS: Record<PosterImageSizeId, string> = {
  "1024x1024": "Square — 1024 × 1024",
  "1024x1792": "Portrait — 1024 × 1792 (GPT: 1024 × 1536)",
  "1792x1024": "Landscape — 1792 × 1024 (GPT: 1536 × 1024)",
};
