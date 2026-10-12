import { z } from "zod";
import { anthropicSuggestHttpError } from "@/lib/server/services/anthropicSuggestRetry";
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
    throw anthropicSuggestHttpError(err, "suggest special days");
  }
}
