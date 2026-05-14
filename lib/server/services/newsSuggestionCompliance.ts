import type { PosterLookId } from "@/lib/types";

/** Approved CTAs — model output must match one of these exactly (after trim). */
export const APPROVED_NEWS_SUGGESTION_CTAS = [
  "Learn more",
  "Book a consultation",
  "Talk to your doctor",
  "Schedule a screening",
  "Know the symptoms",
  "Read about the condition",
] as const;

export type ApprovedNewsSuggestionCta = (typeof APPROVED_NEWS_SUGGESTION_CTAS)[number];

const APPROVED_SET = new Set<string>(APPROVED_NEWS_SUGGESTION_CTAS);

/** Regex rules: run on lowercased text unless noted. */
export const NEWS_COMPLIANCE_RULES: { id: string; pattern: RegExp; description: string }[] = [
  {
    id: "guarantee_language",
    description: "Guarantee / certainty language",
    pattern:
      /\b(guaranteed|certain|promise|assured|no\s+risk|money\s*back)\b|(?:^|[\s(])100\s*%|(?:^|[\s(])100%(?!\d)/i,
  },
  {
    id: "outcome_promises",
    description: "Outcome or cure promises",
    pattern:
      /\b(get\s+pregnant|cures?\b|eliminate\b|fix\s+forever|permanent\s+solution|reverse\s+disease|heal\s+completely|get\s+rid\s+of)\b/i,
  },
  {
    id: "quantified_results",
    description: "Quantified clinical outcomes or success rates",
    pattern:
      /\b\d{1,3}\s*%\+?\s*(success|recovery|cure|healing)|\b\d{2,}\s*%\s*success\b|\b\d+\+?\s*(patients?|people)\s+(cured|healed|saved)\b|\b(98|99|100)\s*%\s*(cure|success|recovery)\b/i,
  },
  {
    id: "superlatives",
    description: "Inflated superlative marketing",
    pattern:
      /(?:#1\b|number\s*one|n[o']?\s*1\b|\bbest\b|\btop\b|\bleading\b|\bmiracle\b|\bbreakthrough\s+cure\b|\bworld[\s-]class\b)/i,
  },
  {
    id: "before_after",
    description: "Before/after implication",
    pattern: /\b(before\s+and\s+after|before\s*\/\s*after|after\s+results\s+guarantee)\b/i,
  },
  {
    id: "comparative_providers",
    description: "Comparative claims vs other providers",
    pattern:
      /\b(better\s+than\s+(other|your)\s+(doctors?|clinics?|hospitals?)|vs\.?\s+other\s+(doctors?|clinics?|hospitals?)|unlike\s+other\s+(doctors?|clinics?|hospitals?))\b/i,
  },
];

const MAX_HEADLINE_WORDS = 8;

export function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function collectTextParts(input: {
  headlines: readonly string[];
  keyTakeaway: string;
  visualDirection: { palette: readonly string[]; mood: string; iconHints: readonly string[] };
  recommendedSpecialtyTags?: readonly string[];
}): string[] {
  const parts: string[] = [...input.headlines, input.keyTakeaway, input.visualDirection.mood];
  for (const p of input.visualDirection.palette) parts.push(p);
  for (const h of input.visualDirection.iconHints) parts.push(h);
  if (input.recommendedSpecialtyTags) parts.push(...input.recommendedSpecialtyTags);
  return parts;
}

export interface NewsSuggestionComplianceInput {
  headlines: readonly string[];
  keyTakeaway: string;
  visualDirection: {
    palette: readonly string[];
    mood: string;
    iconHints: readonly string[];
  };
  cta: string;
  recommendedSpecialtyTags?: readonly string[];
}

export type NewsComplianceStatus = "passed" | "flagged" | "manual_review";

export interface NewsSuggestionComplianceResult {
  ok: boolean;
  status: NewsComplianceStatus;
  flags: string[];
}

/**
 * Validates AI poster suggestions for healthcare marketing guardrails.
 * - Forbidden patterns (regex)
 * - Headlines: max 8 words each, non-empty
 * - CTA: must be exactly from approved whitelist
 */
export function validateNewsPosterSuggestion(input: NewsSuggestionComplianceInput): NewsSuggestionComplianceResult {
  const flags: string[] = [];
  const ctaTrim = input.cta.trim();

  if (input.headlines.length !== 3) {
    flags.push("headlines: require exactly 3 variations");
  }

  for (let i = 0; i < input.headlines.length; i++) {
    const h = input.headlines[i]?.trim() ?? "";
    if (!h) {
      flags.push(`headline[${i}]: empty`);
      continue;
    }
    const n = countWords(h);
    if (n > MAX_HEADLINE_WORDS) {
      flags.push(`headline[${i}]: exceeds ${MAX_HEADLINE_WORDS} words (${n})`);
    }
  }

  if (!input.keyTakeaway.trim()) {
    flags.push("keyTakeaway: empty");
  }

  if (!APPROVED_SET.has(ctaTrim)) {
    flags.push(`cta: not in approved list (got "${ctaTrim}")`);
  }

  const blob = [...collectTextParts(input), ctaTrim].join("\n");
  const lower = blob.toLowerCase();
  for (const rule of NEWS_COMPLIANCE_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(lower)) {
      flags.push(`forbidden:${rule.id}`);
    }
  }

  if (flags.length === 0) {
    return { ok: true, status: "passed", flags: [] };
  }
  return { ok: false, status: "flagged", flags };
}

/** System-prompt block to prepend/append for Claude news-suggestion calls. */
export function newsSuggestionComplianceSystemPrompt(): string {
  const forbiddenLines = NEWS_COMPLIANCE_RULES.map((r) => `- ${r.id}: ${r.description}`).join("\n");
  const ctas = APPROVED_NEWS_SUGGESTION_CTAS.map((c) => `- "${c}"`).join("\n");
  return [
    "Healthcare marketing compliance (mandatory):",
    "",
    "Forbidden patterns (do not use anywhere in headlines, takeaway, palette strings, icon hints, or specialty tags):",
    forbiddenLines,
    "- Avoid any guarantee of medical outcomes, cures, or numerical success rates.",
    "",
    `Each headline: maximum ${MAX_HEADLINE_WORDS} words, hook-first, no hashtags.`,
    "",
    "CTA must be EXACTLY one of the following strings (verbatim, including capitalization):",
    ctas,
    "",
    "Do not compare this clinic to other doctors or hospitals.",
    "Do not use before/after framing.",
  ].join("\n");
}

const MOOD_TO_LOOK: Record<string, PosterLookId> = {
  clinical: "minimal_clean",
  warm: "soft_medical",
  urgent: "bold_marketing",
  educational: "flat_illustration",
};

export function moodToPosterLook(mood: string): PosterLookId {
  const k = mood.trim().toLowerCase();
  return MOOD_TO_LOOK[k] ?? "soft_medical";
}

export function buildPosterLookCustomFromVisual(input: {
  palette: readonly string[];
  iconHints: readonly string[];
}): string {
  const palette = input.palette.map((p) => p.trim()).filter(Boolean).join(", ");
  const icons = input.iconHints.map((p) => p.trim()).filter(Boolean).join(", ");
  const parts: string[] = [];
  if (palette) parts.push(`Suggested palette: ${palette}.`);
  if (icons) parts.push(`Icon / motif hints: ${icons}.`);
  parts.push("Keep claims informational; no outcomes guarantees.");
  const s = parts.join(" ");
  return s.length > 500 ? s.slice(0, 497) + "..." : s;
}
