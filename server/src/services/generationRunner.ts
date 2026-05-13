import { UnrecoverableError } from "bullmq";
import { z } from "zod";
import type { SpecialDay, TopicHistory, GenerationJob } from "@prisma/client";
import type { CalendarPost, GenerateJobPayload } from "@hc/shared";
import type { SpecialDayInput } from "@hc/shared";
import { prisma } from "../lib/prisma";
import { buildPrompt } from "../services/promptEngine";
import { generateCalendarWithClaude } from "../services/claudeService";
import { buildExcel } from "../services/excelBuilder";
import { persistWorkbookForJob } from "../services/storageService";
import { fetchTopicHistoryLastSixMonths } from "../services/topicTracker";
import { emitJobProgress } from "../services/sseHub";
import { logger } from "../lib/logger";

const calendarPostSchema = z.object({
  date: z.string(),
  code: z.enum(["SP1", "SP2", "AWR"]),
  department: z.string(),
  type: z.enum(["Poster", "Carousel"]),
  style: z.string(),
  textInImage: z.string(),
  supportingText: z.string(),
  isAIAdded: z.boolean(),
  specialDayLabel: z.string().nullable(),
  topic: z.string(),
});

export type GenerationProgress = {
  updateProgress: (obj: object) => Promise<void>;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isDateInMonth(dateStr: string, month: number, year: number): boolean {
  const m = `${year}-${pad2(month)}`;
  return dateStr.startsWith(m);
}

const CANCEL_ERR = "JOB_CANCELLED";

export function isCancelledMessage(message: string): boolean {
  return message === CANCEL_ERR;
}

function formatWait(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function throwIfCancelled(jobId: string): Promise<void> {
  const row = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (row?.status === "cancelled") {
    throw new UnrecoverableError(CANCEL_ERR);
  }
}

/** Persist terminal failure + SSE — shared by BullMQ `failed` and Vercel cron. */
export async function finalizeGenerationFailure(
  data: Pick<GenerateJobPayload, "jobId" | "userId" | "month" | "year">,
  err: unknown
): Promise<void> {
  const { jobId, userId, month, year } = data;
  const message = err instanceof Error ? err.message : String(err);
  const isCancelled = message === CANCEL_ERR;
  await prisma.generationJob.updateMany({
    where: { id: jobId },
    data: isCancelled
      ? { status: "cancelled", errorMsg: null }
      : { status: "failed", errorMsg: message },
  });
  const gj = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { client: true },
  });
  emitJobProgress(userId, {
    jobId,
    status: isCancelled ? "cancelled" : "failed",
    clientName: gj?.client.name ?? "Client",
    progress: 0,
    errorMsg: isCancelled ? undefined : message,
    month,
    year,
    phase: isCancelled ? "Stopped" : "Failed",
    elapsedMs: 0,
  });
}

export type ExecuteGenerationOptions = {
  /** When true, the caller already moved the row from pending → processing (e.g. Vercel cron). */
  skipPendingClaim?: boolean;
};

export async function executeGenerationJob(
  data: GenerateJobPayload,
  progress: GenerationProgress,
  options?: ExecuteGenerationOptions
): Promise<{ fileUrl: string }> {
  const { jobId, clientId, month, year, userId, postCountOverride, extraSpecialDays } = data;
  const runStarted = Date.now();

  try {
    await progress.updateProgress({ step: "started", pct: 1 });

    if (!options?.skipPendingClaim) {
      const claimed = await prisma.generationJob.updateMany({
        where: { id: jobId, status: "pending" },
        data: { status: "processing" },
      });
      if (claimed.count === 0) {
        const row = await prisma.generationJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (row?.status === "cancelled") {
          throw new UnrecoverableError(CANCEL_ERR);
        }
        throw new Error(`Job ${jobId} is not pending (state: ${row?.status ?? "missing"})`);
      }
    } else {
      const row = await prisma.generationJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (row?.status === "cancelled") {
        throw new UnrecoverableError(CANCEL_ERR);
      }
      if (row?.status !== "processing") {
        throw new Error(`Job ${jobId} expected processing for cron runner (state: ${row?.status ?? "missing"})`);
      }
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      include: { specialDays: true },
    });

    if (!client) {
      throw new Error("Client not found for job");
    }

    await throwIfCancelled(jobId);

    emitJobProgress(userId, {
      jobId,
      status: "processing",
      clientName: client.name,
      progress: 10,
      month,
      year,
      phase: "Preparing prompt & topic history",
      elapsedMs: Date.now() - runStarted,
    });

    const topicRows = await fetchTopicHistoryLastSixMonths(prisma, clientId, year, month);
    const topicHistory = topicRows.map((t: TopicHistory) => ({
      month: t.month,
      year: t.year,
      topic: t.topic,
      style: t.style,
      postType: t.postType,
    }));

    const dbSpecials: SpecialDayInput[] = client.specialDays
      .filter((s: SpecialDay) => isDateInMonth(s.date, month, year))
      .map((s: SpecialDay) => ({
        label: s.label,
        date: s.date,
        type: s.type as SpecialDayInput["type"],
      }));

    const mergedSpecials: SpecialDayInput[] = [
      ...dbSpecials,
      ...(extraSpecialDays ?? []).map((s) => ({
        label: s.label,
        date: s.date,
        type: s.type as SpecialDayInput["type"],
      })),
    ];

    const effectivePosts =
      typeof postCountOverride === "number" && postCountOverride > 0
        ? postCountOverride
        : client.postsPerMonth;

    const profile = {
      name: client.name,
      doctorName: client.doctorName,
      specialty: client.specialty,
      services: client.services ?? [],
      clinicName: client.clinicName,
      city: client.city,
      brandType: client.brandType,
      postsPerMonth: effectivePosts,
      useCarousels: client.useCarousels,
      notes: client.notes,
      supportingTextDefault: client.supportingTextDefault ?? null,
    };

    const { system, user } = buildPrompt(profile, month, year, mergedSpecials, topicHistory);

    await progress.updateProgress({ step: "prompt_sent", pct: 10 });
    await throwIfCancelled(jobId);

    emitJobProgress(userId, {
      jobId,
      status: "processing",
      clientName: client.name,
      progress: 40,
      month,
      year,
      phase:
        "Generating calendar with Claude — usually 1–6 min depending on month size and API load.",
      elapsedMs: Date.now() - runStarted,
    });

    const claudeWaitStarted = Date.now();
    let heartbeatTicks = 0;
    const heartbeatPing = (): void => {
      heartbeatTicks += 1;
      const waitedMs = Date.now() - claudeWaitStarted;
      const easedProgress = Math.min(49, 40 + heartbeatTicks);
      void progress
        .updateProgress({
          step: "claude_inflight",
          pct: easedProgress,
          waitedSec: Math.round(waitedMs / 1000),
        })
        .catch(() => undefined);
      emitJobProgress(userId, {
        jobId,
        status: "processing",
        clientName: client.name,
        progress: easedProgress,
        month,
        year,
        phase: `Claude is generating your calendar (${formatWait(waitedMs)} so far — still working…)`,
        elapsedMs: Date.now() - runStarted,
      });
    };
    const heartbeatEarly = setTimeout(heartbeatPing, 8_000);
    const heartbeat = setInterval(heartbeatPing, 15_000);

    let rawPosts: Awaited<ReturnType<typeof generateCalendarWithClaude>>;
    try {
      rawPosts = await generateCalendarWithClaude(system, user);
    } finally {
      clearTimeout(heartbeatEarly);
      clearInterval(heartbeat);
    }

    await progress.updateProgress({ step: "claude_responded", pct: 50 });
    await throwIfCancelled(jobId);

    let posts: CalendarPost[];
    try {
      posts = z.array(calendarPostSchema).parse(rawPosts);
    } catch (zErr) {
      logger.error("Calendar JSON failed Zod validation", {
        jobId,
        zErr,
        excerpt: JSON.stringify(rawPosts).slice(0, 4000),
      });
      throw zErr;
    }

    const expected = effectivePosts;
    if (Math.abs(posts.length - expected) > 2) {
      logger.warn("Calendar post count outside target window (±2)", {
        jobId,
        expected,
        actual: posts.length,
      });
    }

    await throwIfCancelled(jobId);
    await prisma.topicHistory.createMany({
      data: posts.map((p) => ({
        clientId,
        month,
        year,
        topic: p.topic,
        style: p.style,
        postType: p.type,
      })),
    });

    emitJobProgress(userId, {
      jobId,
      status: "processing",
      clientName: client.name,
      progress: 70,
      month,
      year,
      phase: "Building Excel and saving file…",
      elapsedMs: Date.now() - runStarted,
    });

    await progress.updateProgress({ step: "excel_building", pct: 75 });
    await throwIfCancelled(jobId);

    const workbookBuffer = await buildExcel(jobId, posts);
    await throwIfCancelled(jobId);

    const fileUrl = await persistWorkbookForJob(jobId, workbookBuffer);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "done", fileUrl, errorMsg: null },
    });

    await progress.updateProgress({ step: "upload_complete", pct: 100 });

    emitJobProgress(userId, {
      jobId,
      status: "done",
      fileUrl,
      clientName: client.name,
      progress: 100,
      month,
      year,
      phase: "Complete",
      elapsedMs: Date.now() - runStarted,
    });

    logger.info("Generation job completed", { jobId });
    return { fileUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await progress.updateProgress({ step: "failed", pct: 0, error: msg }).catch(() => undefined);

    if (e instanceof UnrecoverableError && e.message === CANCEL_ERR) {
      await prisma.topicHistory
        .deleteMany({ where: { clientId, month, year } })
        .catch(() => undefined);
    }
    throw e;
  }
}

/** Build BullMQ / runner payload from a persisted DB row (cron replay). */
export function generationJobRowToPayload(row: GenerationJob): GenerateJobPayload {
  const p = row.payload as {
    postCountOverride?: number;
    extraSpecialDays?: GenerateJobPayload["extraSpecialDays"];
  } | null;
  return {
    jobId: row.id,
    clientId: row.clientId,
    month: row.month,
    year: row.year,
    userId: row.userId,
    postCountOverride: p?.postCountOverride,
    extraSpecialDays: p?.extraSpecialDays,
  };
}
