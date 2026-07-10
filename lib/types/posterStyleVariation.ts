/** Visual style variations from the poster design system. */

export const POSTER_STYLE_VARIATION_IDS = [
  "minimal",
  "luxury",
  "corporate",
  "editorial",
  "magazine",
  "healthcare_premium",
  "modern_flat",
  "glassmorphism",
  "soft_gradient",
  "dark_premium",
  "bold_typography",
  "clean_white",
  "pastel",
  "festive",
  "abstract",
  "geometric",
  "organic_shapes",
  "swiss_design",
  "apple_inspired",
  "material_design",
  "three_d_elements",
  "illustration",
  "photorealistic",
  "random",
] as const;

export type PosterStyleVariationId = (typeof POSTER_STYLE_VARIATION_IDS)[number];

export const POSTER_STYLE_VARIATION_LABELS: Record<PosterStyleVariationId, string> = {
  minimal: "Minimal",
  luxury: "Luxury",
  corporate: "Corporate",
  editorial: "Editorial",
  magazine: "Magazine",
  healthcare_premium: "Healthcare Premium",
  modern_flat: "Modern Flat",
  glassmorphism: "Glassmorphism",
  soft_gradient: "Soft Gradient",
  dark_premium: "Dark Premium",
  bold_typography: "Bold Typography",
  clean_white: "Clean White",
  pastel: "Pastel",
  festive: "Festive",
  abstract: "Abstract",
  geometric: "Geometric",
  organic_shapes: "Organic Shapes",
  swiss_design: "Swiss Design",
  apple_inspired: "Apple Inspired",
  material_design: "Material Design",
  three_d_elements: "3D Elements",
  illustration: "Illustration",
  photorealistic: "Photorealistic",
  random: "Randomize each poster",
};

const STYLE_HINTS: Record<Exclude<PosterStyleVariationId, "random">, string> = {
  minimal: "Minimal — generous whitespace, restrained palette, crisp hierarchy.",
  luxury: "Luxury — refined typography, understated premium feel.",
  corporate: "Corporate — structured grid, professional and authoritative.",
  editorial: "Editorial — magazine-style typography and column flow.",
  magazine: "Magazine — bold cover-like composition with strong masthead energy.",
  healthcare_premium: "Healthcare Premium — clinical trust with elevated private-care polish.",
  modern_flat: "Modern Flat — clean vector shapes, flat color blocks.",
  glassmorphism: "Glassmorphism — frosted panels, subtle depth, light translucency.",
  soft_gradient: "Soft Gradient — gentle tonal gradients, never garish.",
  dark_premium: "Dark Premium — deep background, luminous accent typography.",
  bold_typography: "Bold Typography — headline-driven, type as hero element.",
  clean_white: "Clean White — bright canvas, airy spacing, minimal ornament.",
  pastel: "Pastel — soft muted palette, friendly and approachable.",
  festive: "Festive — celebratory accents while staying professional.",
  abstract: "Abstract — tasteful abstract forms supporting the message.",
  geometric: "Geometric — precise shapes, Swiss-influenced structure.",
  organic_shapes: "Organic Shapes — soft curves, natural flow.",
  swiss_design: "Swiss Design — grid discipline, objective typography.",
  apple_inspired: "Apple Inspired — product-grade simplicity and polish.",
  material_design: "Material Design — layered surfaces, purposeful elevation.",
  three_d_elements: "3D Elements — subtle dimensional accents, not toy-like.",
  illustration: "Illustration — custom illustrated healthcare visuals.",
  photorealistic: "Photorealistic — natural light, polished photography quality.",
};

export function resolvePosterStyleHint(
  styleId: PosterStyleVariationId | undefined,
  index = 0
): string {
  if (!styleId || styleId === "random") {
    const pool = POSTER_STYLE_VARIATION_IDS.filter((id) => id !== "random");
    const picked = pool[index % pool.length]!;
    return STYLE_HINTS[picked];
  }
  return STYLE_HINTS[styleId];
}
