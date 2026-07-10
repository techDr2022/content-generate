import { z } from "zod";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Use a hex color like #1A2B3C");

/** Legacy poster look values kept for existing brand kit JSON in the database. */
const legacyPosterLookSchema = z.enum([
  "text_only",
  "minimal_clean",
  "bold_marketing",
  "soft_medical",
  "photo_realistic",
  "flat_illustration",
  "luxury_elegant",
  "custom",
]);

export const clientBrandKitSchema = z
  .object({
    colors: z
      .object({
        primary: hexColorSchema.optional(),
        secondary: hexColorSchema.optional(),
        accent: hexColorSchema.optional(),
      })
      .optional(),
    typography: z
      .object({
        headingFont: z.string().trim().max(80).optional(),
        bodyFont: z.string().trim().max(80).optional(),
      })
      .optional(),
    grid: z
      .object({
        columns: z.number().int().min(4).max(24).optional(),
        gutterPx: z.number().int().min(0).max(120).optional(),
      })
      .optional(),
    designGuidelines: z.string().max(12_000).optional(),
    strictGuidelines: z.boolean().optional(),
    defaultPosterLook: legacyPosterLookSchema.optional(),
    posterLookCustom: z.string().max(500).optional(),
    rotatePosterStyles: z.boolean().optional(),
    posterLookPool: z.array(legacyPosterLookSchema).max(8).optional(),
    /** Saved header template; supports [Doctor Name], [Clinic Name], [City]. */
    posterHeader: z.string().max(800).optional(),
    /** Saved footer template (phone, address, etc.); same placeholders. */
    posterFooter: z.string().max(2000).optional(),
    /** When multiple doctors on the client, rotate featured doctor across calendar rows. */
    rotateDoctors: z.boolean().optional(),
  })
  .strict();

export type ClientBrandKit = z.infer<typeof clientBrandKitSchema>;

export function emptyBrandKit(): ClientBrandKit {
  return {};
}

export function parseClientBrandKit(raw: unknown): ClientBrandKit | null {
  if (raw === null || raw === undefined) return null;
  const parsed = clientBrandKitSchema.safeParse(raw);
  if (!parsed.success) return null;
  const kit = parsed.data;
  if (Object.keys(kit).length === 0) return null;
  return kit;
}

/** Returns null when the kit has no meaningful fields (omit on save). */
export function sanitizeBrandKitForSave(kit: ClientBrandKit | null | undefined): ClientBrandKit | null {
  if (!kit) return null;
  const out: ClientBrandKit = {};
  if (kit.colors && Object.values(kit.colors).some(Boolean)) {
    out.colors = {
      ...(kit.colors.primary ? { primary: kit.colors.primary } : {}),
      ...(kit.colors.secondary ? { secondary: kit.colors.secondary } : {}),
      ...(kit.colors.accent ? { accent: kit.colors.accent } : {}),
    };
  }
  if (kit.typography && (kit.typography.headingFont || kit.typography.bodyFont)) {
    out.typography = {
      ...(kit.typography.headingFont ? { headingFont: kit.typography.headingFont } : {}),
      ...(kit.typography.bodyFont ? { bodyFont: kit.typography.bodyFont } : {}),
    };
  }
  if (kit.grid && (kit.grid.columns !== undefined || kit.grid.gutterPx !== undefined)) {
    out.grid = {
      ...(kit.grid.columns !== undefined ? { columns: kit.grid.columns } : {}),
      ...(kit.grid.gutterPx !== undefined ? { gutterPx: kit.grid.gutterPx } : {}),
    };
  }
  if (kit.designGuidelines?.trim()) out.designGuidelines = kit.designGuidelines.trim();
  if (kit.strictGuidelines) out.strictGuidelines = true;
  if (kit.defaultPosterLook) out.defaultPosterLook = kit.defaultPosterLook;
  if (kit.posterLookCustom?.trim()) out.posterLookCustom = kit.posterLookCustom.trim();
  if (kit.rotatePosterStyles) out.rotatePosterStyles = true;
  if (kit.posterLookPool?.length) out.posterLookPool = kit.posterLookPool;
  if (kit.posterHeader?.trim()) out.posterHeader = kit.posterHeader.trim();
  if (kit.posterFooter?.trim()) out.posterFooter = kit.posterFooter.trim();
  if (kit.rotateDoctors) out.rotateDoctors = true;
  return Object.keys(out).length > 0 ? out : null;
}

export function brandKitHasVisualRules(kit: ClientBrandKit | null | undefined): boolean {
  if (!kit) return false;
  return Boolean(
    kit.colors?.primary ||
      kit.colors?.secondary ||
      kit.colors?.accent ||
      kit.typography?.headingFont ||
      kit.typography?.bodyFont ||
      kit.grid?.columns ||
      kit.grid?.gutterPx ||
      kit.designGuidelines?.trim()
  );
}
