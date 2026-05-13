import { z } from "zod";
import {
  MEDICAL_SPECIALTIES,
  validateClientServices,
  isValidCustomSpecialtyName,
  MAX_SPECIALTIES_PER_CLIENT,
} from "@/lib/types";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { fetchTopicHistoryLastSixMonths } from "@/lib/server/services/topicTracker";

const specialtyValue = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) => (MEDICAL_SPECIALTIES as readonly string[]).includes(s) || isValidCustomSpecialtyName(s),
    "Invalid specialty"
  );

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
  specialty: z
    .array(specialtyValue)
    .min(1)
    .max(MAX_SPECIALTIES_PER_CLIENT)
    .superRefine((arr, ctx) => {
      const seen = new Set<string>();
      for (let i = 0; i < arr.length; i++) {
        const k = arr[i].toLowerCase();
        if (seen.has(k)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate specialties",
            path: [i],
          });
          return;
        }
        seen.add(k);
      }
    }),
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

export async function listClients(userId: string, searchParams: URLSearchParams) {
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const specialty = searchParams.get("specialty") ?? "";

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
  return { success: true as const, data: clients };
}

export async function getClient(userId: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, userId },
    include: { specialDays: true },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  return { success: true as const, data: client };
}

export async function createClient(userId: string, body: unknown) {
  const parsed = clientBody.parse(body);
  assertServicesValid(parsed.services, parsed.specialty);
  const client = await prisma.client.create({
    data: {
      name: parsed.name,
      doctorName: parsed.doctorName,
      specialty: parsed.specialty,
      services: parsed.services,
      clinicName: parsed.clinicName,
      city: parsed.city,
      brandType: parsed.brandType,
      postsPerMonth: parsed.postsPerMonth ?? 15,
      useCarousels: parsed.useCarousels ?? false,
      notes: parsed.notes ?? null,
      supportingTextDefault: parsed.supportingTextDefault ?? null,
      userId,
      specialDays: parsed.specialDays?.length
        ? {
            create: parsed.specialDays.map((s) => ({
              label: s.label,
              date: s.date,
              type: s.type,
            })),
          }
        : undefined,
    },
    include: { specialDays: true },
  });
  return { success: true as const, data: client, statusCode: 201 as const };
}

export async function updateClient(userId: string, id: string, body: unknown) {
  const parsed = clientBody.partial().parse(body);
  const existing = await prisma.client.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new HttpError(404, "Client not found");
  }

  const mergedSpecialty = parsed.specialty ?? existing.specialty;
  const mergedServices = parsed.services === undefined ? existing.services : parsed.services;
  assertServicesValid(mergedServices, mergedSpecialty);

  if (parsed.specialDays) {
    await prisma.specialDay.deleteMany({ where: { clientId: existing.id } });
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      name: parsed.name ?? existing.name,
      doctorName: parsed.doctorName ?? existing.doctorName,
      specialty: parsed.specialty ?? existing.specialty,
      services: parsed.services === undefined ? existing.services : parsed.services,
      clinicName: parsed.clinicName ?? existing.clinicName,
      city: parsed.city ?? existing.city,
      brandType: parsed.brandType ?? existing.brandType,
      postsPerMonth: parsed.postsPerMonth ?? existing.postsPerMonth,
      useCarousels: parsed.useCarousels ?? existing.useCarousels,
      notes: parsed.notes === undefined ? existing.notes : parsed.notes,
      supportingTextDefault:
        parsed.supportingTextDefault === undefined
          ? existing.supportingTextDefault
          : parsed.supportingTextDefault,
      specialDays: parsed.specialDays
        ? {
            create: parsed.specialDays.map((s) => ({
              label: s.label,
              date: s.date,
              type: s.type,
            })),
          }
        : undefined,
    },
    include: { specialDays: true },
  });
  return { success: true as const, data: client };
}

export async function deleteClient(userId: string, id: string) {
  const existing = await prisma.client.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new HttpError(404, "Client not found");
  }
  await prisma.client.delete({ where: { id: existing.id } });
  return { success: true as const, data: { id: existing.id } };
}

export async function getClientHistory(userId: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  const now = new Date();
  const history = await fetchTopicHistoryLastSixMonths(prisma, client.id, now.getFullYear(), now.getMonth() + 1);
  return { success: true as const, data: history };
}
