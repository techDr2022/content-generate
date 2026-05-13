import type { Request, Response } from "express";
import fs from "fs";
import ExcelJS from "exceljs";
import { Job } from "bullmq";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { CalendarPost } from "@hc/shared";
import { addGenerateJobWithRetry } from "../lib/queueEnqueue";
import { useCronDatabaseJobRunner } from "../lib/jobRunnerMode";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { addSseConnection, emitJobProgress, removeSseConnection } from "../services/sseHub";
import { getContentQueue } from "../services/jobQueue";
import { getLocalWorkbookPath } from "../services/storageService";
import { generationJobRowToPayload } from "../services/generationRunner";

export async function listJobs(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const jobs = await prisma.generationJob.findMany({
    where: { userId },
    include: { client: { select: { id: true, name: true, doctorName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ success: true, data: jobs });
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const jobId = req.params.id;
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId },
    include: { client: { select: { name: true } } },
  });
  if (!job) {
    throw new HttpError(404, "Job not found");
  }
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
    throw new HttpError(400, "This job is already finished and cannot be stopped.");
  }

  const updated = await prisma.generationJob.updateMany({
    where: {
      id: jobId,
      userId,
      status: { in: ["pending", "processing"] },
    },
    data: { status: "cancelled", errorMsg: null },
  });
  if (updated.count === 0) {
    throw new HttpError(400, "Job could not be stopped (it may have just completed).");
  }

  try {
    if (!useCronDatabaseJobRunner()) {
      await getContentQueue().remove(jobId);
    }
  } catch {
    // Job may already be active; worker cooperates via DB status.
  }

  emitJobProgress(userId, {
    jobId,
    status: "cancelled",
    clientName: job.client.name,
    progress: 0,
    month: job.month,
    year: job.year,
    phase: "Stopped by you",
    elapsedMs: 0,
  });

  res.json({ success: true, data: { id: jobId, status: "cancelled" as const } });
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const job = await prisma.generationJob.findFirst({
    where: { id: req.params.id, userId },
    include: { client: { select: { id: true, name: true, doctorName: true } } },
  });
  if (!job) {
    throw new HttpError(404, "Job not found");
  }
  res.json({ success: true, data: job });
}

/**
 * Optional per-job SSE: polls BullMQ job state via Job.fromId + DB row for file URL.
 */
export async function streamJobProgress(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const jobId = req.params.id;

  const gj = await prisma.generationJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!gj) {
    throw new HttpError(404, "Job not found");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let queue: ReturnType<typeof getContentQueue>;
  try {
    queue = getContentQueue();
  } catch {
    res.write(`data: ${JSON.stringify({ dbStatus: gj.status, error: "Redis unavailable" })}\n\n`);
    res.end();
    return;
  }

  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  const finish = (): void => {
    if (closed) return;
    closed = true;
    if (interval) clearInterval(interval);
    res.end();
  };

  const poll = async (): Promise<void> => {
    const dbJob = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: { status: true, fileUrl: true, errorMsg: true },
    });
    const bullJob = await Job.fromId(queue, jobId);
    let bullState: string | null = null;
    let progress: unknown = null;
    let returnvalue: unknown = null;
    if (bullJob) {
      bullState = await bullJob.getState();
      progress = bullJob.progress;
      returnvalue = bullJob.returnvalue;
    }

    let fileUrl = dbJob?.fileUrl ?? undefined;
    if (
      !fileUrl &&
      returnvalue &&
      typeof returnvalue === "object" &&
      returnvalue !== null &&
      "fileUrl" in returnvalue
    ) {
      fileUrl = String((returnvalue as { fileUrl?: string }).fileUrl ?? "");
    }

    res.write(
      `data: ${JSON.stringify({
        state: bullState ?? dbJob?.status,
        bullState,
        dbStatus: dbJob?.status,
        progress,
        fileUrl: fileUrl || undefined,
        errorMsg: dbJob?.errorMsg ?? undefined,
      })}\n\n`
    );

    const terminalDb = ["done", "failed", "cancelled"].includes(dbJob?.status ?? "");
    const terminalBull = bullState === "completed" || bullState === "failed";
    if (terminalDb || terminalBull) {
      finish();
    }
  };

  interval = setInterval(() => {
    void poll().catch(() => finish());
  }, 1000);

  req.on("close", finish);

  await poll().catch(() => finish());
}

export async function streamJobs(req: Request, res: Response): Promise<void> {
  const userIdParam = typeof req.query.userId === "string" ? req.query.userId : "";
  const tokenUserId = req.auth?.sub;
  if (!userIdParam) {
    throw new HttpError(400, "userId query parameter is required");
  }
  if (!tokenUserId || tokenUserId !== userIdParam) {
    throw new HttpError(403, "userId query must match authenticated user");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Helps reverse proxies (and some dev proxies) avoid buffering SSE chunks.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  addSseConnection(tokenUserId, res);
  res.write(`data: ${JSON.stringify({ success: true, data: { connected: true } })}\n\n`);

  req.on("close", () => {
    removeSseConnection(tokenUserId, res);
  });
}

export async function previewJobCalendar(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const job = await prisma.generationJob.findFirst({
    where: { id: req.params.id, userId, status: "done" },
  });
  if (!job) {
    throw new HttpError(404, "Completed job not found");
  }
  const storage = process.env.STORAGE_TYPE ?? "LOCAL";
  if (storage !== "LOCAL") {
    throw new HttpError(400, "Preview is only available for LOCAL storage exports");
  }
  const path = getLocalWorkbookPath(job.id);
  if (!fs.existsSync(path)) {
    throw new HttpError(404, "Workbook not found on disk");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new HttpError(500, "Workbook has no sheets");
  }

  const rows: CalendarPost[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const date = String(row.getCell(1).value ?? "").trim();
    let codeRaw = String(row.getCell(2).value ?? "").trim();
    let isAIAdded = false;
    if (codeRaw.startsWith("➕ ADDED — ")) {
      isAIAdded = true;
      codeRaw = codeRaw.replace("➕ ADDED — ", "").trim();
    }
    const code = codeRaw as CalendarPost["code"];
    const department = String(row.getCell(3).value ?? "").trim();
    const type = String(row.getCell(4).value ?? "").trim() as CalendarPost["type"];
    const style = String(row.getCell(5).value ?? "").trim();
    const textInImage = String(row.getCell(6).value ?? "").trim();
    const supportingText = String(row.getCell(7).value ?? "").trim();
    const topicGuess = `${department} — ${style}`.trim();
    rows.push({
      date,
      code,
      department,
      type,
      style,
      textInImage,
      supportingText,
      isAIAdded,
      specialDayLabel: null,
      topic: topicGuess,
    });
  });

  res.json({ success: true, data: rows });
}

export async function downloadJob(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const job = await prisma.generationJob.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!job || job.status !== "done" || !job.fileUrl) {
    throw new HttpError(404, "File not available");
  }

  const storage = process.env.STORAGE_TYPE ?? "LOCAL";
  if (storage === "S3" && job.fileUrl.startsWith("http")) {
    res.redirect(302, job.fileUrl);
    return;
  }

  const path = getLocalWorkbookPath(job.id);
  if (!fs.existsSync(path)) {
    throw new HttpError(404, "File missing on disk");
  }
  res.download(path, `calendar-${job.clientId}-${job.year}-${job.month}.xlsx`);
}

const regenerateBody = z.object({
  postCountOverride: z.number().int().min(1).max(62).optional(),
});

export async function regenerateJob(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const failed = await prisma.generationJob.findFirst({
    where: { id: req.params.id, userId, status: "failed" },
    include: { client: true },
  });
  if (!failed) {
    throw new HttpError(404, "Failed job not found");
  }

  const body = regenerateBody.parse(req.body ?? {});
  const postCount =
    typeof body.postCountOverride === "number" && body.postCountOverride > 0
      ? body.postCountOverride
      : failed.postCount;

  const mergedPayload: Record<string, unknown> = {
    ...(failed.payload !== null &&
    typeof failed.payload === "object" &&
    !Array.isArray(failed.payload)
      ? (failed.payload as Record<string, unknown>)
      : {}),
  };
  if (body.postCountOverride !== undefined) {
    mergedPayload.postCountOverride = body.postCountOverride;
  }

  const job = await prisma.generationJob.create({
    data: {
      clientId: failed.clientId,
      userId,
      month: failed.month,
      year: failed.year,
      postCount,
      status: "pending",
      ...(Object.keys(mergedPayload).length > 0
        ? { payload: mergedPayload as Prisma.InputJsonValue }
        : {}),
    },
  });

  const payload = generationJobRowToPayload(job);

  if (!useCronDatabaseJobRunner()) {
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
        "Could not enqueue the job after several retries. Check REDIS_URL and try again."
      );
    }
  }

  res.status(202).json({
    success: true,
    jobId: job.id,
    status: "queued" as const,
    data: job,
  });
}
