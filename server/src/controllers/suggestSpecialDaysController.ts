import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { suggestSpecialDaysWithClaude } from "../services/suggestSpecialDaysService";

const bodySchema = z.object({
  clientId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export async function suggestSpecialDays(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = bodySchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id: body.clientId, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  if (!client.specialty?.length) {
    throw new HttpError(400, "Client has no specialties — add specialties on the client profile first.");
  }

  const data = await suggestSpecialDaysWithClaude({
    specialties: client.specialty,
    clinicName: client.clinicName,
    city: client.city,
    month: body.month,
    year: body.year,
  });

  res.json({ success: true, data });
}
