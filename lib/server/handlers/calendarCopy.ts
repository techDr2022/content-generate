import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { parseDoctorNames } from "@/lib/doctors";
import { parseClientBrandKit } from "@/lib/types/brandKit";
import type { BrandType } from "@/lib/types";
import {
  regenerateCalendarField,
  type RegenerateCalendarField,
} from "@/lib/server/services/regenerateCalendarField";

const calendarPostInputSchema = z.object({
  date: z.string(),
  code: z.enum(["SP1", "SP2", "AWR"]),
  department: z.string(),
  type: z.enum(["Poster", "Carousel", "Animated"]),
  style: z.string(),
  textInImage: z.string(),
  supportingText: z.string(),
  isAIAdded: z.boolean(),
  specialDayLabel: z.string().nullable(),
  topic: z.string(),
});

const regenerateFieldBodySchema = z.object({
  clientId: z.string().min(1),
  field: z.enum(["textInImage", "supportingText"]),
  post: calendarPostInputSchema,
  rowIndex: z.number().int().min(0).optional().default(0),
});

export async function regenerateCalendarFieldHandler(userId: string, body: unknown) {
  const parsed = regenerateFieldBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first?.message ?? "Invalid request body");
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }

  const profile = {
    name: client.name,
    doctorName: client.doctorName,
    specialty: client.specialty,
    services: client.services ?? [],
    clinicName: client.clinicName,
    city: client.city,
    brandType: client.brandType,
    postsPerMonth: client.postsPerMonth,
    useCarousels: client.useCarousels,
    notes: client.notes,
    generationNotes: client.generationNotes ?? null,
    supportingTextDefault: client.supportingTextDefault ?? null,
    brandKit: parseClientBrandKit(client.brandKit),
    doctors: parseDoctorNames(client.doctorName, client.brandType as BrandType),
  };

  try {
    const result = await regenerateCalendarField({
      field: parsed.data.field,
      post: parsed.data.post,
      client: profile,
      rowIndex: parsed.data.rowIndex,
    });
    return { success: true as const, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new HttpError(503, msg);
    }
    throw new HttpError(502, `Could not regenerate copy: ${msg}`);
  }
}
