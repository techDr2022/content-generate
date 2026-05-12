import Anthropic from "@anthropic-ai/sdk";
import type { MedicalSpecialty } from "@hc/shared";
import {
  getAvailableServicesForSpecialties,
  isValidCustomServiceName,
  MAX_SERVICES_PER_CLIENT,
} from "@hc/shared";

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
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

function normalizeSuggestedServices(raw: unknown[], specialties: string[]): string[] {
  const catalog = new Set(getAvailableServicesForSpecialties(specialties as MedicalSpecialty[]));
  const out: string[] = [];
  const seenLower = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().replace(/\s+/g, " ");
    if (!t) continue;

    let accepted = t;
    if (!catalog.has(t)) {
      const fromCatalog = [...catalog].find((c) => c.toLowerCase() === t.toLowerCase());
      if (fromCatalog) accepted = fromCatalog;
      else if (!isValidCustomServiceName(t)) continue;
    }

    const key = accepted.toLowerCase();
    if (seenLower.has(key)) continue;
    seenLower.add(key);
    out.push(accepted);
    if (out.length >= MAX_SERVICES_PER_CLIENT) break;
  }

  return out;
}

/**
 * Claude proposes an ordered list of service lines from the catalog (and rare valid custom lines).
 */
export async function suggestServicesWithClaude(params: {
  specialties: string[];
  clinicName?: string;
  city?: string;
  doctorName?: string;
  notes?: string;
}): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  if (!params.specialties.length) {
    throw new Error("No specialties provided");
  }

  const allowedCatalog = getAvailableServicesForSpecialties(params.specialties as MedicalSpecialty[]);
  if (allowedCatalog.length === 0) {
    throw new Error("No service catalog for the selected specialties");
  }

  const model = anthropicModel();
  const system = `You are a healthcare digital marketing assistant. You output ONLY valid JSON — no markdown, no explanation outside JSON.`;

  const ctx = [
    params.doctorName ? `Doctor / provider context: ${params.doctorName}` : "",
    params.clinicName ? `Clinic name: ${params.clinicName}` : "",
    params.city ? `City: ${params.city}` : "",
    params.notes ? `Internal notes (use lightly): ${params.notes.slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user = `TASK: Pick an ordered list of marketing "service lines" for this medical client's profile.

SELECTED SPECIALTIES (must stay within these): ${JSON.stringify(params.specialties)}

CLIENT CONTEXT:
${ctx || "(none)"}

ALLOWED SERVICE LINES — you MUST prefer EXACT strings from this list (copy spelling and punctuation exactly). Only add a short custom line if essential and it reads like a single service offering (max 120 characters, plain text):
${JSON.stringify(allowedCatalog)}

RULES:
1. Order matters: put the STRONGEST / most differentiating services FIRST (generator uses priority).
2. Prefer 10–24 lines when the catalog allows; fewer is OK for narrow practices.
3. Every item must either be an EXACT match from ALLOWED SERVICE LINES above OR a valid short custom service label (no hashtags, no HTML).
4. Return a JSON array of strings ONLY, e.g. ["Line one","Line two"]`;

  const client = new Anthropic({
    apiKey,
    timeout: Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "", 10) >= 60_000
      ? Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "", 10)
      : 120_000,
    maxRetries: 0,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
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

  return normalizeSuggestedServices(parsed, params.specialties);
}
