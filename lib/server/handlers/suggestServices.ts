import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { suggestServicesWithClaude } from "@/lib/server/services/suggestServicesService";

const bodySchema = z.object({
  specialties: z.array(z.string()).min(1, "Select at least one specialty"),
  clinicName: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  doctorName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function suggestServices(body: unknown) {
  const parsed = bodySchema.parse(body ?? {});

  try {
    const services = await suggestServicesWithClaude({
      specialties: parsed.specialties,
      clinicName: parsed.clinicName,
      city: parsed.city,
      doctorName: parsed.doctorName,
      notes: parsed.notes,
    });
    return { success: true as const, data: { services } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new HttpError(503, msg);
    }
    throw new HttpError(502, `Could not suggest services: ${msg}`);
  }
}
