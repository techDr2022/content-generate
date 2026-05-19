import type { ClientBrandKit } from "@/lib/types/brandKit";

export interface PosterLayoutContext {
  doctorName: string;
  clinicName: string;
  city: string;
}

const PLACEHOLDERS: Record<string, keyof PosterLayoutContext> = {
  "[Doctor Name]": "doctorName",
  "[Clinic Name]": "clinicName",
  "[City]": "city",
};

/** Replace [Doctor Name], [Clinic Name], [City] in a saved header/footer template. */
export function applyPosterTemplate(template: string, ctx: PosterLayoutContext): string {
  let out = template;
  for (const [token, key] of Object.entries(PLACEHOLDERS)) {
    out = out.split(token).join(ctx[key] ?? "");
  }
  return out.trim();
}

/** Merge saved footer, optional extra contact lines, and resolved header for image prompts. */
export function buildPosterLayoutForPrompt(input: {
  brandKit?: ClientBrandKit | null;
  ctx: PosterLayoutContext;
  extraContactDetails?: string;
}): { headerBlock?: string; footerBlock?: string } {
  const kit = input.brandKit;
  const headerRaw = kit?.posterHeader?.trim();
  const footerRaw = kit?.posterFooter?.trim();
  const extra = input.extraContactDetails?.trim();

  const headerBlock = headerRaw ? applyPosterTemplate(headerRaw, input.ctx) : undefined;
  let footerBlock = footerRaw ? applyPosterTemplate(footerRaw, input.ctx) : undefined;
  if (extra) {
    footerBlock = footerBlock ? `${footerBlock}\n\n${extra}` : extra;
  }

  return {
    ...(headerBlock ? { headerBlock } : {}),
    ...(footerBlock ? { footerBlock } : {}),
  };
}

/** Pre-fill session contact field from client footer template (no doctor token yet). */
export function defaultContactFromBrandKit(
  brandKit: ClientBrandKit | null | undefined,
  ctx: Omit<PosterLayoutContext, "doctorName"> & { doctorName?: string }
): string {
  const footer = brandKit?.posterFooter?.trim();
  if (!footer) return "";
  return applyPosterTemplate(footer, {
    doctorName: ctx.doctorName ?? "",
    clinicName: ctx.clinicName,
    city: ctx.city,
  });
}
