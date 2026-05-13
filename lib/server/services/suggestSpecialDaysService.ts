import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const itemSchema = z.object({
  label: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["festival", "awareness", "campaign"]),
});

export type SuggestedSpecialDay = z.infer<typeof itemSchema>;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateInTargetMonth(dateStr: string, month: number, year: number): boolean {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  return y === year && m === month;
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

function parseJsonArray(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const arrStart = cleaned.indexOf("[");
  const objStart = cleaned.indexOf("{");
  let start = -1;
  if (arrStart !== -1 && objStart !== -1) start = Math.min(arrStart, objStart);
  else if (arrStart !== -1) start = arrStart;
  else if (objStart !== -1) start = objStart;
  if (start === -1) throw new Error("No JSON in response");
  return JSON.parse(cleaned.slice(start)) as unknown;
}

/**
 * Uses Claude to propose awareness/festival days in the given month that match the client's specialties,
 * plus suitable broad public-health observances — excluding unrelated specialty-specific days.
 */
export async function suggestSpecialDaysWithClaude(params: {
  specialties: string[];
  clinicName: string;
  city: string;
  month: number;
  year: number;
}): Promise<SuggestedSpecialDay[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const monthName = MONTH_NAMES[params.month - 1] ?? String(params.month);
  const model = anthropicModel();

  const system = `You are a healthcare marketing assistant. You output ONLY valid JSON — no markdown, no prose.`;

  const user = `TASK: List suggested social-media "special days" for ONE calendar month for a medical clinic.

CLIENT CONTEXT:
- Medical specialties (ONLY these matter for clinical relevance): ${JSON.stringify(params.specialties)}
- Clinic: ${params.clinicName}
- City: ${params.city}

TARGET MONTH: ${monthName} ${params.year}

RULES:
1. Include awareness days, health observances, and widely recognized calendar moments that are RELEVANT to the client's specialties above (e.g. Gynaecology → women's health / cervical / PCOS / maternal health observances in this month when they exist).
2. You MAY include a SMALL number of broad cross-cutting public health days (e.g. World Health Day) ONLY if they fall in ${monthName} ${params.year} — skip if not in this month.
3. STRICTLY EXCLUDE observances dedicated to unrelated specialties (example: if the client is NOT dentistry/oral surgery, do NOT include World Oral Health Day).
4. Every "date" MUST be YYYY-MM-DD and MUST fall inside ${monthName} ${params.year} only.
5. Prefer internationally or regionally recognized names; keep labels concise for Instagram planning.
6. type: use "awareness" for health observances, "festival" for cultural/religious holidays when relevant to the audience, "campaign" for branded/public drives.
7. Return between 4 and 20 items when possible; fewer if the month truly has almost nothing on-topic.

OUTPUT SHAPE (JSON array only):
[{"label":"string","date":"YYYY-MM-DD","type":"awareness"|"festival"|"campaign"}, ...]`;

  const client = new Anthropic({
    apiKey,
    timeout: Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "", 10) >= 60_000
      ? Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "", 10)
      : 120_000,
    maxRetries: 0,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text in Claude response");
  }

  const parsed = parseJsonArray(textBlock.text);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from Claude");
  }

  const out: SuggestedSpecialDay[] = [];
  const seen = new Set<string>();

  for (const row of parsed) {
    const one = itemSchema.safeParse(row);
    if (!one.success) continue;
    const item = one.data;
    if (!dateInTargetMonth(item.date, params.month, params.year)) continue;
    const key = `${item.date}|${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
