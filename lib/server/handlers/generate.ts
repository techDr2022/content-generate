import { z } from "zod";
import { MAX_ANIMATED_PER_MONTH, MAX_CAROUSELS_PER_MONTH } from "@/lib/constants/cadence";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { addGenerateJobWithRetry } from "@/lib/server/queueEnqueue";
import { getContentQueue } from "@/lib/server/services/jobQueue";
import { emitJobProgress } from "@/lib/server/services/sseHub";
import { Prisma } from "@prisma/client";

const specialDayRunSchema = z.object({
  label: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["festival", "awareness", "campaign"]),
});

const singleSchema = z.object({
  clientId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  postCountOverride: z.number().int().min(1).max(62).optional(),
  carouselCountOverride: z.number().int().min(0).max(MAX_CAROUSELS_PER_MONTH).optional(),
  animatedCountOverride: z.number().int().min(0).max(MAX_ANIMATED_PER_MONTH).optional(),
  extraSpecialDays: z.array(specialDayRunSchema).optional(),
});

const bulkSchema = z.object({
  jobs: z.array(singleSchema).min(1, { message: "jobs must include at least one month to generate" }),
});

function optionalEnqueuePayload(body: {
  postCountOverride?: number;
  carouselCountOverride?: number;
  animatedCountOverride?: number;
  extraSpecialDays?: z.infer<typeof specialDayRunSchema>[];
}): Record<string, unknown> | undefined {
  if (
    body.postCountOverride === undefined &&
    body.carouselCountOverride === undefined &&
    body.animatedCountOverride === undefined &&
    body.extraSpecialDays === undefined
  ) {
    return undefined;
  }
  return {
    ...(body.postCountOverride !== undefined ? { postCountOverride: body.postCountOverride } : {}),
    ...(body.carouselCountOverride !== undefined ? { carouselCountOverride: body.carouselCountOverride } : {}),
    ...(body.animatedCountOverride !== undefined ? { animatedCountOverride: body.animatedCountOverride } : {}),
    ...(body.extraSpecialDays !== undefined ? { extraSpecialDays: body.extraSpecialDays } : {}),
  };
}

export async function enqueueGenerate(userId: string, body: unknown) {
  const parsed = singleSchema.parse(body);

  const client = await prisma.client.findFirst({
    where: { id: parsed.clientId, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }

  const clientCarousels =
    typeof client.carouselsPerMonth === "number" && client.carouselsPerMonth > 0
      ? client.carouselsPerMonth
      : 0;
  const clientAnimated =
    typeof client.animatedPerMonth === "number" && client.animatedPerMonth > 0
      ? client.animatedPerMonth
      : 0;
  const postCount =
    typeof parsed.postCountOverride === "number" && parsed.postCountOverride > 0
      ? parsed.postCountOverride
      : client.postsPerMonth + clientCarousels + clientAnimated;

  const storedPayload = optionalEnqueuePayload(parsed);

  const job = await prisma.generationJob.create({
    data: {
      clientId: client.id,
      userId,
      month: parsed.month,
      year: parsed.year,
      postCount,
      status: "pending",
      ...(storedPayload !== undefined ? { payload: storedPayload as Prisma.InputJsonValue } : {}),
    },
  });

  const payload = {
    jobId: job.id,
    clientId: client.id,
    month: parsed.month,
    year: parsed.year,
    userId,
    postCountOverride: parsed.postCountOverride,
    carouselCountOverride: parsed.carouselCountOverride,
    animatedCountOverride: parsed.animatedCountOverride,
    extraSpecialDays: parsed.extraSpecialDays,
  };

  try {
    await addGenerateJobWithRetry(getContentQueue(), payload, { jobId: job.id, attempts: 1 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMsg: `Could not reach job queue (Redis): ${msg}` },
    });
    throw new HttpError(
      503,
      "Could not enqueue the job after several retries. Check REDIS_URL and that Redis is reachable, then try again."
    );
  }

  emitJobProgress(userId, {
    jobId: job.id,
    status: "pending",
    clientName: client.name,
    progress: 2,
    month: parsed.month,
    year: parsed.year,
    phase: "Queued — waiting for worker",
    elapsedMs: 0,
  });

  return {
    success: true as const,
    jobId: job.id,
    status: "queued" as const,
    data: job,
    statusCode: 202 as const,
  };
}

export async function enqueueBulkGenerate(userId: string, body: unknown) {
  const parsed = bulkSchema.parse(body);
  const queue = getContentQueue();
  const created: Awaited<ReturnType<typeof prisma.generationJob.create>>[] = [];

  for (const item of parsed.jobs) {
    const client = await prisma.client.findFirst({
      where: { id: item.clientId, userId },
    });
    if (!client) {
      throw new HttpError(404, `Client not found: ${item.clientId}`);
    }
    const clientCarousels =
      typeof client.carouselsPerMonth === "number" && client.carouselsPerMonth > 0
        ? client.carouselsPerMonth
        : 0;
    const clientAnimated =
      typeof client.animatedPerMonth === "number" && client.animatedPerMonth > 0
        ? client.animatedPerMonth
        : 0;
    const postCount =
      typeof item.postCountOverride === "number" && item.postCountOverride > 0
        ? item.postCountOverride
        : client.postsPerMonth + clientCarousels + clientAnimated;

    const storedPayload = optionalEnqueuePayload(item);

    const job = await prisma.generationJob.create({
      data: {
        clientId: client.id,
        userId,
        month: item.month,
        year: item.year,
        postCount,
        status: "pending",
        ...(storedPayload !== undefined ? { payload: storedPayload as Prisma.InputJsonValue } : {}),
      },
    });
    const payload = {
      jobId: job.id,
      clientId: client.id,
      month: item.month,
      year: item.year,
      userId,
      postCountOverride: item.postCountOverride,
      carouselCountOverride: item.carouselCountOverride,
      animatedCountOverride: item.animatedCountOverride,
      extraSpecialDays: item.extraSpecialDays,
    };
    try {
      await addGenerateJobWithRetry(queue, payload, { jobId: job.id, attempts: 1 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", errorMsg: `Could not reach job queue (Redis): ${msg}` },
      });
      throw new HttpError(
        503,
        `Could not enqueue job for ${item.year}-${item.month} after several retries. Check Redis, then try again.`
      );
    }
    emitJobProgress(userId, {
      jobId: job.id,
      status: "pending",
      clientName: client.name,
      progress: 2,
      month: item.month,
      year: item.year,
      phase: "Queued — waiting for worker",
      elapsedMs: 0,
    });
    created.push(job);
  }

  return {
    success: true as const,
    status: "queued" as const,
    jobIds: created.map((j) => j.id),
    data: created,
    statusCode: 202 as const,
  };
}

const suggestSpecialDaysBody = z.object({
  clientId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export async function suggestSpecialDays(userId: string, body: unknown) {
  const parsed = suggestSpecialDaysBody.parse(body);

  const client = await prisma.client.findFirst({
    where: { id: parsed.clientId, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }
  if (!client.specialty?.length) {
    throw new HttpError(400, "Client has no specialties — add specialties on the client profile first.");
  }

  const { suggestSpecialDaysWithClaude } = await import("@/lib/server/services/suggestSpecialDaysService");
  try {
    const data = await suggestSpecialDaysWithClaude({
      specialties: client.specialty,
      clinicName: client.clinicName,
      city: client.city,
      month: parsed.month,
      year: parsed.year,
    });

    return { success: true as const, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new HttpError(503, msg);
    }
    if (/529|overloaded|Overloaded|rate_limit|429/i.test(msg)) {
      throw new HttpError(
        503,
        "Anthropic is temporarily overloaded or rate-limited. Wait 30–60 seconds and try Suggest days again."
      );
    }
    throw new HttpError(502, `Could not suggest special days: ${msg}`);
  }
}
