import type { ClientBrandKit } from "@/lib/types/brandKit";
import { brandKitHasVisualRules } from "@/lib/types/brandKit";

function colorLine(label: string, hex?: string): string | null {
  const v = hex?.trim();
  return v ? `- ${label}: ${v}` : null;
}

/** Visual brand rules for OpenAI poster prompts. */
export function formatBrandKitForImagePrompt(kit: ClientBrandKit | null | undefined): string {
  if (!kit || !brandKitHasVisualRules(kit)) return "";

  const lines: string[] = ["BRAND VISUAL SYSTEM (mandatory — do not deviate):"];

  const colorLines = [
    colorLine("Primary brand color", kit.colors?.primary),
    colorLine("Secondary color", kit.colors?.secondary),
    colorLine("Accent color", kit.colors?.accent),
  ].filter((l): l is string => Boolean(l));
  if (colorLines.length > 0) {
    lines.push("Color palette:", ...colorLines.map((l) => `  ${l}`));
  }

  if (kit.typography?.headingFont || kit.typography?.bodyFont) {
    lines.push("Typography:");
    if (kit.typography.headingFont) {
      lines.push(`  - Headlines / titles: ${kit.typography.headingFont}`);
    }
    if (kit.typography.bodyFont) {
      lines.push(`  - Body / supporting text on poster: ${kit.typography.bodyFont}`);
    }
  }

  if (kit.grid?.columns || kit.grid?.gutterPx !== undefined) {
    const parts: string[] = [];
    if (kit.grid.columns) parts.push(`${kit.grid.columns}-column grid`);
    if (kit.grid.gutterPx !== undefined) parts.push(`${kit.grid.gutterPx}px gutters`);
    lines.push(`Layout grid: use a ${parts.join(", ")} for alignment and spacing.`);
  }

  const guidelines = kit.designGuidelines?.trim();
  if (guidelines) {
    lines.push(
      kit.strictGuidelines
        ? "STRICT design guidelines (every rule is mandatory):"
        : "Design guidelines:",
      guidelines
    );
  }

  if (kit.strictGuidelines) {
    lines.push(
      "Do not introduce colors, fonts, or layout patterns outside this brand system unless required for legibility."
    );
  }

  return lines.join("\n");
}

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
