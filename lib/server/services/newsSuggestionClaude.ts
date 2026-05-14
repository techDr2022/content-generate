import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { logger } from "@/lib/server/logger";
import { parseJsonArrayFromClaudeText } from "@/lib/server/services/claudeService";
import {
  newsSuggestionComplianceSystemPrompt,
  validateNewsPosterSuggestion,
  type NewsComplianceStatus,
} from "@/lib/server/services/newsSuggestionCompliance";
import { catalogSpecialtiesForPrompt } from "@/lib/server/services/trendingNewsSpecialties";

const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

function claudeModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  return fromEnv || DEFAULT_CLAUDE_MODEL;
}

const outputSchema = z.object({
  headlines: z.array(z.string()).length(3),
  keyTakeaway: z.string().min(1).max(900),
  visualDirection: z.object({
    palette: z.array(z.string()).min(2).max(8),
    mood: z.enum(["clinical", "warm", "urgent", "educational"]),
    iconHints: z.array(z.string()).min(1).max(8),
  }),
  recommendedSpecialtyTags: z.array(z.string()).min(1).max(8),
  cta: z.string().min(1),
});

export interface GenerateNewsSuggestionInput {
  headline: string;
  summary: string;
  specialtyTags: string[];
  sources: { name: string; url: string }[];
}

export interface GenerateNewsSuggestionResult {
  headlines: string[];
  keyTakeaway: string;
  visualDirection: z.infer<typeof outputSchema>["visualDirection"];
  recommendedSpecialtyTags: string[];
  cta: string;
  complianceStatus: NewsComplianceStatus;
  complianceFlags: string[];
}

function buildUserMessage(input: GenerateNewsSuggestionInput): string {
  const lines = [
    "Create poster marketing suggestions for a healthcare clinic audience in India and globally.",
    "",
    `Headline: ${input.headline}`,
    `Summary: ${input.summary}`,
    `Detected specialties (hints): ${input.specialtyTags.join(", ")}`,
    "",
    "Sources:",
    ...input.sources.slice(0, 6).map((s) => `- ${s.name}: ${s.url}`),
    "",
    "Return ONLY valid JSON (no markdown fences) with this shape:",
    `{
  "headlines": ["string","string","string"],
  "keyTakeaway": "string",
  "visualDirection": { "palette": ["string"], "mood": "clinical|warm|urgent|educational", "iconHints": ["string"] },
  "recommendedSpecialtyTags": ["string"],
  "cta": "one of the approved CTAs verbatim"
}`,
    "",
    `Choose recommendedSpecialtyTags from this catalog when possible: ${catalogSpecialtiesForPrompt()}`,
  ];
  return lines.join("\n");
}

function safeFallback(input: GenerateNewsSuggestionInput): GenerateNewsSuggestionResult {
  const h = input.headline.trim();
  const short = h.length > 48 ? `${h.slice(0, 45)}…` : h;
  return {
    headlines: [
      short,
      "What clinicians want patients to know",
      "A calm, factual look at the update",
    ].map((s) => s.split(/\s+/).slice(0, 8).join(" ")),
    keyTakeaway:
      "This is a developing story shared for general awareness. It is not personal medical advice; speak with a qualified clinician about your situation.",
    visualDirection: {
      palette: ["soft blue", "warm white", "slate"],
      mood: "educational",
      iconHints: ["stethoscope outline", "document"],
    },
    recommendedSpecialtyTags: input.specialtyTags.slice(0, 4),
    cta: "Learn more",
    complianceStatus: "manual_review",
    complianceFlags: ["fallback_after_retries"],
  };
}

export async function generateNewsPosterSuggestionWithClaude(
  input: GenerateNewsSuggestionInput
): Promise<GenerateNewsSuggestionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return safeFallback(input);
  }

  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 0 });
  const model = claudeModel();
  const system = [
    newsSuggestionComplianceSystemPrompt(),
    "",
    "Output JSON only. No markdown. No extra keys.",
  ].join("\n");

  let lastFlags: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const user =
      attempt === 0
        ? buildUserMessage(input)
        : `${buildUserMessage(input)}\n\nPrevious attempt failed validation: ${lastFlags.join(
            "; "
          )}. Regenerate a fully compliant JSON object.`;

    const started = Date.now();
    logger.info("Claude news suggestion request", { model, attempt });
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
    });
    logger.info("Claude news suggestion response", { attempt, elapsedMs: Date.now() - started });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      lastFlags = ["no_text_block"];
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonArrayFromClaudeText(textBlock.text);
    } catch {
      lastFlags = ["json_parse_error"];
      continue;
    }

    const parsed = outputSchema.safeParse(parsedJson);
    if (!parsed.success) {
      lastFlags = parsed.error.issues.map((i) => i.message);
      continue;
    }

    const v = validateNewsPosterSuggestion({
      headlines: parsed.data.headlines,
      keyTakeaway: parsed.data.keyTakeaway,
      visualDirection: parsed.data.visualDirection,
      cta: parsed.data.cta,
      recommendedSpecialtyTags: parsed.data.recommendedSpecialtyTags,
    });

    if (v.ok) {
      return {
        headlines: parsed.data.headlines.map((h) => h.trim()),
        keyTakeaway: parsed.data.keyTakeaway.trim(),
        visualDirection: parsed.data.visualDirection,
        recommendedSpecialtyTags: parsed.data.recommendedSpecialtyTags.map((s) => s.trim()),
        cta: parsed.data.cta.trim(),
        complianceStatus: "passed",
        complianceFlags: [],
      };
    }

    lastFlags = v.flags;
  }

  const fb = safeFallback(input);
  const check = validateNewsPosterSuggestion({
    headlines: fb.headlines,
    keyTakeaway: fb.keyTakeaway,
    visualDirection: fb.visualDirection,
    cta: fb.cta,
    recommendedSpecialtyTags: fb.recommendedSpecialtyTags,
  });
  return {
    ...fb,
    complianceStatus: check.ok ? "passed" : "manual_review",
    complianceFlags: [...fb.complianceFlags, ...lastFlags.slice(0, 12)],
  };
}
