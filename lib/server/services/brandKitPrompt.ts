import type { ClientBrandKit } from "@/lib/types/brandKit";

/** Brand voice / compliance for Claude calendar generation. */
export function formatBrandKitForCalendarPrompt(kit: ClientBrandKit | null | undefined): string {
  if (!kit) return "";

  const lines: string[] = [];
  const guidelines = kit.designGuidelines?.trim();
  if (guidelines) {
    lines.push(
      kit.strictGuidelines
        ? "CLIENT DESIGN & BRAND GUIDELINES (strict — follow exactly in tone, structure, and any visual references in copy):"
        : "CLIENT DESIGN & BRAND GUIDELINES:",
      guidelines
    );
  }

  if (kit.colors?.primary || kit.typography?.headingFont) {
    lines.push(
      "When describing visuals in textInImage, align language with the client's brand palette and typography preferences from the profile JSON (brandKit)."
    );
  }

  const header = kit.posterHeader?.trim();
  const footer = kit.posterFooter?.trim();
  if (header || footer) {
    lines.push("POSTER LAYOUT TEMPLATES (for textInImage / caption alignment — clinic city lines stay in image footer per global rules):");
    if (header) {
      lines.push(
        `Header template (use [Doctor Name], [Clinic Name], [City] placeholders when rotating doctors): ${header}`
      );
    }
    if (footer) {
      lines.push(`Footer template (consistent on every poster): ${footer}`);
    }
  }

  return lines.join("\n\n");
}

/** Brand colors, typography, and guidelines for OpenAI poster image prompts. */
export function formatBrandKitForImagePrompt(kit: ClientBrandKit | null | undefined): string {
  if (!kit) return "";

  const lines: string[] = ["BRAND KIT (strict — follow exactly):"];

  const { colors, typography } = kit;
  if (colors?.primary || colors?.secondary || colors?.accent) {
    const parts: string[] = [];
    if (colors.primary) parts.push(`primary ${colors.primary}`);
    if (colors.secondary) parts.push(`secondary ${colors.secondary}`);
    if (colors.accent) parts.push(`accent ${colors.accent}`);
    lines.push(`Colors: ${parts.join(", ")}. Never use colors outside this palette.`);
  }

  if (typography?.headingFont || typography?.bodyFont) {
    const parts: string[] = [];
    if (typography.headingFont) parts.push(`heading "${typography.headingFont}"`);
    if (typography.bodyFont) parts.push(`body "${typography.bodyFont}"`);
    lines.push(`Typography: ${parts.join(", ")}.`);
  }

  if (kit.grid?.columns || kit.grid?.gutterPx) {
    lines.push(
      `Grid: ${kit.grid.columns ?? "—"} columns, ${kit.grid.gutterPx ?? "—"}px gutter.`
    );
  }

  const guidelines = kit.designGuidelines?.trim();
  if (guidelines) {
    lines.push(
      kit.strictGuidelines
        ? `Design guidelines (strict):\n${guidelines}`
        : `Design guidelines:\n${guidelines}`
    );
  }

  const header = kit.posterHeader?.trim();
  const footer = kit.posterFooter?.trim();
  if (header) lines.push(`Header template: ${header}`);
  if (footer) lines.push(`Footer template: ${footer}`);

  return lines.length > 1 ? lines.join("\n") : "";
}
