import fs from "fs";
import ExcelJS from "exceljs";
import { Job } from "bullmq";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { CalendarPost } from "@/lib/types";
import { addGenerateJobWithRetry } from "@/lib/server/queueEnqueue";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { addSseConnection, emitJobProgress, removeSseConnection } from "@/lib/server/services/sseHub";
import { getContentQueue } from "@/lib/server/services/jobQueue";
import { getLocalWorkbookPath, loadWorkbookBufferForJob } from "@/lib/server/services/storageService";
import { generationJobRowToPayload } from "@/lib/server/services/generationRunner";

export async function listJobs(userId: string) {
  const jobs = await prisma.generationJob.findMany({
    where: { userId },
    include: { client: { select: { id: true, name: true, doctorName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { success: true as const, data: jobs };
}

export async function cancelJob(userId: string, jobId: string) {
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
    await getContentQueue().remove(jobId);
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

  return { success: true as const, data: { id: jobId, status: "cancelled" as const } };
}

export async function getJob(userId: string, jobId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId },
    include: { client: { select: { id: true, name: true, doctorName: true } } },
  });
  if (!job) {
    throw new HttpError(404, "Job not found");
  }
  return { success: true as const, data: job };
}

export function createJobStreamResponse(userId: string): Response {
  const encoder = new TextEncoder();
  let controllerRef!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      addSseConnection(userId, controller);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ success: true, data: { connected: true } })}\n\n`)
      );
    },
    cancel() {
      removeSseConnection(userId, controllerRef);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function createJobProgressStreamResponse(userId: string, jobId: string): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const gj = await prisma.generationJob.findFirst({
        where: { id: jobId, userId },
      });
      if (!gj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`));
        controller.close();
        return;
      }

      let queue: ReturnType<typeof getContentQueue>;
      try {
        queue = getContentQueue();
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ dbStatus: gj.status, error: "Redis unavailable" })}\n\n`)
        );
        controller.close();
        return;
      }

      let closed = false;
      let interval: ReturnType<typeof setInterval> | undefined;
      const finish = (): void => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
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

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              state: bullState ?? dbJob?.status,
              bullState,
              dbStatus: dbJob?.status,
              progress,
              fileUrl: fileUrl || undefined,
              errorMsg: dbJob?.errorMsg ?? undefined,
            })}\n\n`
          )
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

      await poll().catch(() => finish());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function previewJobCalendar(userId: string, jobId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId, status: "done" },
  });
  if (!job) {
    throw new HttpError(404, "Completed job not found");
  }

  const buffer = await loadWorkbookBufferForJob({ id: job.id, fileUrl: job.fileUrl });
  const workbook = new ExcelJS.Workbook();
  // exceljs typings are stricter than Node's Buffer generic; runtime is fine.
  await workbook.xlsx.load(buffer as never);
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

  return { success: true as const, data: rows };
}

export async function downloadJobFile(userId: string, jobId: string): Promise<Response> {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, userId },
  });
  if (!job || job.status !== "done" || !job.fileUrl) {
    throw new HttpError(404, "File not available");
  }

  const storage = process.env.STORAGE_TYPE ?? "LOCAL";
  if (storage === "S3" && job.fileUrl.startsWith("http")) {
    return Response.redirect(job.fileUrl, 302);
  }

  const path = getLocalWorkbookPath(job.id);
  if (!fs.existsSync(path)) {
    throw new HttpError(404, "File missing on disk");
  }
  const buf = await fs.promises.readFile(path);
  const filename = `calendar-${job.clientId}-${job.year}-${job.month}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const regenerateBody = z.object({
  postCountOverride: z.number().int().min(1).max(62).optional(),
});

export async function regenerateJob(userId: string, jobId: string, body: unknown) {
  const failed = await prisma.generationJob.findFirst({
    where: { id: jobId, userId, status: "failed" },
    include: { client: true },
  });
  if (!failed) {
    throw new HttpError(404, "Failed job not found");
  }

  const parsed = regenerateBody.parse(body ?? {});
  const postCount =
    typeof parsed.postCountOverride === "number" && parsed.postCountOverride > 0
      ? parsed.postCountOverride
      : failed.postCount;

  const mergedPayload: Record<string, unknown> = {
    ...(failed.payload !== null &&
    typeof failed.payload === "object" &&
    !Array.isArray(failed.payload)
      ? (failed.payload as Record<string, unknown>)
      : {}),
  };
  if (parsed.postCountOverride !== undefined) {
    mergedPayload.postCountOverride = parsed.postCountOverride;
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

  return {
    success: true as const,
    jobId: job.id,
    status: "queued" as const,
    data: job,
    statusCode: 202 as const,
  };
}
