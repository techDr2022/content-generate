import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { useCronDatabaseJobRunner } from "../lib/jobRunnerMode";
import { HttpError } from "../middleware/errorHandler";
import { addGenerateJobWithRetry } from "../lib/queueEnqueue";
import { getContentQueue } from "../services/jobQueue";
import { emitJobProgress } from "../services/sseHub";

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
  extraSpecialDays: z.array(specialDayRunSchema).optional(),
});

const bulkSchema = z.object({
  jobs: z
    .array(singleSchema)
    .min(1, { message: "jobs must include at least one month to generate" }),
});

function optionalEnqueuePayload(body: {
  postCountOverride?: number;
  extraSpecialDays?: z.infer<typeof specialDayRunSchema>[];
}): Record<string, unknown> | undefined {
  if (body.postCountOverride === undefined && body.extraSpecialDays === undefined) return undefined;
  return {
    ...(body.postCountOverride !== undefined ? { postCountOverride: body.postCountOverride } : {}),
    ...(body.extraSpecialDays !== undefined ? { extraSpecialDays: body.extraSpecialDays } : {}),
  };
}

export async function enqueueGenerate(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = singleSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id: body.clientId, userId },
  });
  if (!client) {
    throw new HttpError(404, "Client not found");
  }

  const postCount =
    typeof body.postCountOverride === "number" && body.postCountOverride > 0
      ? body.postCountOverride
      : client.postsPerMonth;

  const storedPayload = optionalEnqueuePayload(body);

  const job = await prisma.generationJob.create({
    data: {
      clientId: client.id,
      userId,
      month: body.month,
      year: body.year,
      postCount,
      status: "pending",
      ...(storedPayload !== undefined ? { payload: storedPayload as Prisma.InputJsonValue } : {}),
    },
  });

  const payload = {
    jobId: job.id,
    clientId: client.id,
    month: body.month,
    year: body.year,
    userId,
    postCountOverride: body.postCountOverride,
    extraSpecialDays: body.extraSpecialDays,
  };

  const cronRunner = useCronDatabaseJobRunner();

  if (!cronRunner) {
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
  }

  emitJobProgress(userId, {
    jobId: job.id,
    status: "pending",
    clientName: client.name,
    progress: 2,
    month: body.month,
    year: body.year,
    phase: cronRunner ? "Queued — scheduler will pick this up shortly" : "Queued — waiting for worker",
    elapsedMs: 0,
  });

  res.status(202).json({
    success: true,
    jobId: job.id,
    status: "queued" as const,
    data: job,
  });
}

export async function enqueueBulkGenerate(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = bulkSchema.parse(req.body);
  const cronRunner = useCronDatabaseJobRunner();
  const queue = cronRunner ? null : getContentQueue();
  const created: Awaited<ReturnType<typeof prisma.generationJob.create>>[] = [];

  for (const item of body.jobs) {
    const client = await prisma.client.findFirst({
      where: { id: item.clientId, userId },
    });
    if (!client) {
      throw new HttpError(404, `Client not found: ${item.clientId}`);
    }
    const postCount =
      typeof item.postCountOverride === "number" && item.postCountOverride > 0
        ? item.postCountOverride
        : client.postsPerMonth;

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
      extraSpecialDays: item.extraSpecialDays,
    };
    if (!cronRunner && queue) {
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
    }
    emitJobProgress(userId, {
      jobId: job.id,
      status: "pending",
      clientName: client.name,
      progress: 2,
      month: item.month,
      year: item.year,
      phase: cronRunner ? "Queued — scheduler will pick this up shortly" : "Queued — waiting for worker",
      elapsedMs: 0,
    });
    created.push(job);
  }

  res.status(202).json({
    success: true,
    status: "queued" as const,
    jobIds: created.map((j) => j.id),
    data: created,
  });
}
