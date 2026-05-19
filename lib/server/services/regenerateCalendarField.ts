import type { CalendarPost } from "@/lib/types";
import { parseDoctorNames, resolveDoctorForPosterIndex } from "@/lib/doctors";
import type { BrandType } from "@/lib/types";
import { requestClaudeJson } from "./claudeService";
import type { ClientPromptProfile } from "./promptEngine";
import { logger } from "../logger";

export type RegenerateCalendarField = "textInImage" | "supportingText";

const TEXT_IN_IMAGE_SYSTEM = `You are an expert healthcare Instagram copywriter. Generate ONLY the "textInImage" field for one calendar row.

Rules:
- Match the row's "style" format (Short Statement, Myth vs Fact, Dos & Don'ts, Q&A, etc.).
- Short, poster-ready, Instagram-clean.
- End with exactly ONE CTA from: "Consult our expert" / "Book an appointment" / "Visit our clinic" / "Meet our specialist".
- End with clinic name and city on separate lines (from client profile). Do NOT include doctor name in image text.
- For type "Animated": start with "▶ Reel tip:" or similar hook; 3–5 short on-screen lines; motion-friendly.
- For type "Carousel": use lists or stepwise layout suitable for slides.
- Use \\n for line breaks inside the string value in JSON.
- Healthcare compliance: no guaranteed outcomes or cures.

Respond with JSON only: { "textInImage": "..." }. No markdown fences.`;

const SUPPORTING_TEXT_SYSTEM = `You are an expert healthcare Instagram copywriter. Generate ONLY the "supportingText" field for one calendar row.

Rules:
- REQUIRED ORDER inside supportingText:
  1) Main body: engaging caption with 3–6 professional emojis in the main body only; include doctor name, clinic, specialty, city; patient-friendly clinical depth.
  2) One blank line (\\n\\n).
  3) If client.supportingTextDefault is non-empty: insert it VERBATIM before hashtags.
  4) One blank line.
  5) Hashtag block LAST: 8–14 hashtags on one line. Nothing after hashtags.
- For type "Animated": mention watching the reel once naturally.
- Use \\n for line breaks inside the string value in JSON.
- Healthcare compliance: no guaranteed outcomes or cures.

Respond with JSON only: { "supportingText": "..." }. No markdown fences.`;

function buildUserMessage(
  field: RegenerateCalendarField,
  post: CalendarPost,
  client: ClientPromptProfile,
  rowIndex: number
): string {
  const doctors = client.doctors ?? parseDoctorNames(client.doctorName, client.brandType as BrandType);
  const featuredDoctor = resolveDoctorForPosterIndex(
    doctors,
    rowIndex,
    doctors.length > 1
  );

  const existing = field === "textInImage" ? post.textInImage : post.supportingText;
  const mode = existing.trim() ? "Regenerate (improve or replace)" : "Generate new";

  return `${mode} ${field} for this row.

CLIENT:
${JSON.stringify(
    {
      doctorName: client.doctorName,
      featuredDoctorForThisRow: featuredDoctor || client.doctorName,
      doctors,
      clinicName: client.clinicName,
      city: client.city,
      specialty: client.specialty,
      services: client.services,
      supportingTextDefault: client.supportingTextDefault,
      generationNotes: client.generationNotes,
      brandKit: client.brandKit,
    },
    null,
    2
  )}

ROW (keep date, code, department, type, style, topic, flags unchanged — only output the requested field):
${JSON.stringify(post, null, 2)}

${existing.trim() ? `CURRENT ${field} (you may improve or fully replace):\n${existing}` : ""}`;
}

function extractFieldValue(parsed: unknown, field: RegenerateCalendarField): string {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Claude returned invalid JSON shape");
  }
  const obj = parsed as Record<string, unknown>;
  const raw = obj[field];
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`Claude response missing "${field}" string`);
  }
  return raw.trim();
}

export async function regenerateCalendarField(input: {
  field: RegenerateCalendarField;
  post: CalendarPost;
  client: ClientPromptProfile;
  rowIndex: number;
}): Promise<{ value: string }> {
  const system = input.field === "textInImage" ? TEXT_IN_IMAGE_SYSTEM : SUPPORTING_TEXT_SYSTEM;
  const user = buildUserMessage(input.field, input.post, input.client, input.rowIndex);
  const maxTokens = input.field === "textInImage" ? 2048 : 4096;

  logger.info("Regenerating calendar field", {
    field: input.field,
    style: input.post.style,
    type: input.post.type,
    rowIndex: input.rowIndex,
  });

  const parsed = await requestClaudeJson(system, user, maxTokens);
  const value = extractFieldValue(parsed, input.field);

  return { value };
}
