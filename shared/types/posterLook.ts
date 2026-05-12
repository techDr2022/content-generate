/** Visual direction for OpenAI poster generation (combined only with “Text in image” copy). */

export const POSTER_LOOK_IDS = [
  "text_only",
  "minimal_clean",
  "bold_marketing",
  "soft_medical",
  "photo_realistic",
  "flat_illustration",
  "luxury_elegant",
  "custom",
] as const;

export type PosterLookId = (typeof POSTER_LOOK_IDS)[number];

/** Style-only hint (a professional healthcare baseline is always added on the server). Empty for `text_only`; ignored for `custom`. */
export const POSTER_LOOK_HINTS: Record<Exclude<PosterLookId, "custom">, string> = {
  text_only: "",
  minimal_clean:
    "Layout: minimal executive healthcare layout—generous whitespace, clear hierarchy, restrained clinical palette.",
  bold_marketing:
    "Layout: bold but professional hospital/clinic campaign—high contrast, strong hierarchy, still trustworthy.",
  soft_medical:
    "Layout: soft reassuring clinic aesthetic—clean imagery, blues/teals/whites, approachable and medical-grade.",
  photo_realistic:
    "Layout: photorealistic professional medical marketing—natural light, polished stock-photo quality, dignified.",
  flat_illustration:
    "Layout: modern flat illustration—friendly vector-style healthcare artwork, inclusive and brand-safe.",
  luxury_elegant:
    "Layout: premium private-care feel—refined typography, subtle gradients, understated luxury.",
};

export const POSTER_LOOK_LABELS: Record<PosterLookId, string> = {
  text_only: "Text in image focus (healthcare-safe baseline only)",
  minimal_clean: "Minimal & clean",
  bold_marketing: "Bold marketing",
  soft_medical: "Soft medical / clinic",
  photo_realistic: "Photorealistic",
  flat_illustration: "Flat illustration",
  luxury_elegant: "Luxury / elegant",
  custom: "Custom instructions…",
};
