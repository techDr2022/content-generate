import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler";
import { suggestServicesWithClaude } from "../services/suggestServicesService";

const bodySchema = z.object({
  specialties: z.array(z.string()).min(1, "Select at least one specialty"),
  clinicName: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  doctorName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function suggestServices(req: Request, res: Response): Promise<void> {
  const body = bodySchema.parse(req.body ?? {});

  try {
    const services = await suggestServicesWithClaude({
      specialties: body.specialties,
      clinicName: body.clinicName,
      city: body.city,
      doctorName: body.doctorName,
      notes: body.notes,
    });
    res.json({ success: true, data: { services } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new HttpError(503, msg);
    }
    throw new HttpError(502, `Could not suggest services: ${msg}`);
  }
}
