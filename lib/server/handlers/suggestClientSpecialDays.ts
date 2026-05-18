import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { suggestSpecialDaysWithClaude } from "@/lib/server/services/suggestSpecialDaysService";

const bodySchema = z.object({
  specialties: z.array(z.string()).min(1, "Select at least one specialty"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  clinicName: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
});

export async function suggestClientSpecialDays(body: unknown) {
  const parsed = bodySchema.parse(body ?? {});

  try {
    const days = await suggestSpecialDaysWithClaude({
      specialties: parsed.specialties,
      clinicName: parsed.clinicName?.trim() || "Medical practice",
      city: parsed.city?.trim() || "India",
      month: parsed.month,
      year: parsed.year,
    });
    return { success: true as const, data: { days } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new HttpError(503, msg);
    }
    if (/529|overloaded|Overloaded|rate_limit|429/i.test(msg)) {
      throw new HttpError(
        503,
        "Anthropic is temporarily overloaded or rate-limited. Wait 30–60 seconds and try again."
      );
    }
    throw new HttpError(502, `Could not suggest special days: ${msg}`);
  }
}
