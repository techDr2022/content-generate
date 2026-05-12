import type { Request, Response } from "express";
import { z } from "zod";
import { MEDICAL_SPECIALTIES, validateClientServices } from "@hc/shared";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { fetchTopicHistoryLastSixMonths } from "../services/topicTracker";

const specialtyValue = z
  .string()
  .refine((s) => (MEDICAL_SPECIALTIES as readonly string[]).includes(s), "Invalid specialty");

const specialDaySchema = z.object({
  label: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["festival", "awareness", "campaign"]),
});

function normalizePostsPerMonth(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  const n = typeof val === "string" ? Number(val) : Number(val);
  if (!Number.isFinite(n) || n < 1) return 15;
  return Math.min(62, Math.floor(n));
}

const clientBody = z.object({
  name: z.string().min(1),
  doctorName: z.string().min(1),
  specialty: z.array(specialtyValue).min(1),
  services: z.array(z.string()).optional().default([]),
  clinicName: z.string().min(1),
  city: z.string().min(1),
  brandType: z.enum(["clinic", "personal", "hospital"]),
  postsPerMonth: z.preprocess(normalizePostsPerMonth, z.number().int().min(1).max(62).optional()),
  useCarousels: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  supportingTextDefault: z.string().max(8000).nullable().optional(),
  specialDays: z.array(specialDaySchema).optional(),
});

function assertServicesValid(services: string[], specialty: string[]): void {
  if (!validateClientServices(services, specialty)) {
    throw new HttpError(
      400,
      "Invalid services: use catalog checkboxes and/or custom lines (2–120 chars). Max 40 entries. Custom lines must not use angle brackets or braces."
    );
  }
}

export async function listClients(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const specialty = typeof req.query.specialty === "string" ? req.query.specialty : "";

  const clients = await prisma.client.findMany({
    where: {
      userId,
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { doctorName: { contains: q, mode: "insensitive" } },
                { clinicName: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        specialty ? { specialty: { has: specialty } } : {},
      ],
    },
    include: { specialDays: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ success: true, data: clients });
}

export async function getClient(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId },
    include: { specialDays: true },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  res.json({ success: true, data: client });
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = clientBody.parse(req.body);
  assertServicesValid(body.services, body.specialty);
  const client = await prisma.client.create({
    data: {
      name: body.name,
      doctorName: body.doctorName,
      specialty: body.specialty,
      services: body.services,
      clinicName: body.clinicName,
      city: body.city,
      brandType: body.brandType,
      postsPerMonth: body.postsPerMonth ?? 15,
      useCarousels: body.useCarousels ?? false,
      notes: body.notes ?? null,
      supportingTextDefault: body.supportingTextDefault ?? null,
      userId,
      specialDays: body.specialDays?.length
        ? {
            create: body.specialDays.map((s) => ({
              label: s.label,
              date: s.date,
              type: s.type,
            })),
          }
        : undefined,
    },
    include: { specialDays: true },
  });
  res.status(201).json({ success: true, data: client });
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = clientBody.partial().parse(req.body);
  const existing = await prisma.client.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    throw new HttpError(404, "Client not found");
  }

  const mergedSpecialty = body.specialty ?? existing.specialty;
  const mergedServices = body.services === undefined ? existing.services : body.services;
  assertServicesValid(mergedServices, mergedSpecialty);

  if (body.specialDays) {
    await prisma.specialDay.deleteMany({ where: { clientId: existing.id } });
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      name: body.name ?? existing.name,
      doctorName: body.doctorName ?? existing.doctorName,
      specialty: body.specialty ?? existing.specialty,
      services: body.services === undefined ? existing.services : body.services,
      clinicName: body.clinicName ?? existing.clinicName,
      city: body.city ?? existing.city,
      brandType: body.brandType ?? existing.brandType,
      postsPerMonth: body.postsPerMonth ?? existing.postsPerMonth,
      useCarousels: body.useCarousels ?? existing.useCarousels,
      notes: body.notes === undefined ? existing.notes : body.notes,
      supportingTextDefault:
        body.supportingTextDefault === undefined
          ? existing.supportingTextDefault
          : body.supportingTextDefault,
      specialDays: body.specialDays
        ? {
            create: body.specialDays.map((s) => ({
              label: s.label,
              date: s.date,
              type: s.type,
            })),
          }
        : undefined,
    },
    include: { specialDays: true },
  });
  res.json({ success: true, data: client });
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const existing = await prisma.client.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!existing) {
    throw new HttpError(404, "Client not found");
  }
  await prisma.client.delete({ where: { id: existing.id } });
  res.json({ success: true, data: { id: existing.id } });
}

export async function getClientHistory(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  const now = new Date();
  const history = await fetchTopicHistoryLastSixMonths(
    prisma,
    client.id,
    now.getFullYear(),
    now.getMonth() + 1
  );
  res.json({ success: true, data: history });
}
