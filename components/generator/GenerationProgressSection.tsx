"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { formatDuration } from "@/lib/formatDuration";
import { useElapsedMs } from "@/hooks/useElapsedMs";
import { cn } from "@/lib/utils";
import type { JobProgressEvent } from "@/lib/types";

interface GenerationProgressSectionProps {
  barPercent: number;
  batchActive: boolean;
  runStartedAt: number | null;
  sessionEvent: JobProgressEvent | null;
  streamError: string | null;
  pollPhaseHint: string | null;
  activeJobPollLoading: boolean;
  inClaudePhase: boolean;
  activeJobId: string | undefined;
  activeJobPollStatus: string | undefined;
  activeJobPollIsLoading: boolean;
  activeJobPollIsError: boolean;
}

export function GenerationProgressSection({
  barPercent,
  batchActive,
  runStartedAt,
  sessionEvent,
  streamError,
  pollPhaseHint,
  activeJobPollLoading,
  inClaudePhase,
  activeJobId,
  activeJobPollStatus,
  activeJobPollIsLoading,
  activeJobPollIsError,
}: GenerationProgressSectionProps) {
  const wallElapsedMs = useElapsedMs(batchActive ? runStartedAt : null);

  const stuckPendingNoWorker = useMemo(
    () =>
      Boolean(activeJobId) &&
      batchActive &&
      wallElapsedMs >= 22_000 &&
      !activeJobPollIsLoading &&
      !activeJobPollIsError &&
      activeJobPollStatus === "pending",
    [activeJobId, activeJobPollIsError, activeJobPollIsLoading, activeJobPollStatus, batchActive, wallElapsedMs]
  );

  return (
    <>
      {stuckPendingNoWorker ? <WorkerStuckWarning /> : null}

      <ProgressCard
        barPercent={barPercent}
        batchActive={batchActive}
        wallElapsedMs={wallElapsedMs}
        sessionEvent={sessionEvent}
        streamError={streamError}
        pollPhaseHint={pollPhaseHint}
        activeJobPollLoading={activeJobPollLoading}
        inClaudePhase={inClaudePhase}
      />
    </>
  );
}

function WorkerStuckWarning() {
  return (
    <div
      className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-50"
      role="status"
    >
      <p className="font-medium">Generation is waiting on the worker</p>
      <p className="mt-1 text-xs leading-relaxed opacity-95">
        This screen only <em>queues</em> jobs. Run the BullMQ worker so Redis jobs execute: from the project root, in a{" "}
        <strong>second terminal</strong> run <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">npm run worker</code>{" "}
        (same <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">.env</code> /{" "}
        <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">.env.local</code> as <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">npm run dev</code>
        ), or use <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">npm run dev:all</code> to start Next and the worker together. Ensure{" "}
        <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">REDIS_URL</code> is set.
      </p>
    </div>
  );
}

interface ProgressCardProps {
  barPercent: number;
  batchActive: boolean;
  wallElapsedMs: number;
  sessionEvent: JobProgressEvent | null;
  streamError: string | null;
  pollPhaseHint: string | null;
  activeJobPollLoading: boolean;
  inClaudePhase: boolean;
}

function ProgressCard({
  barPercent,
  batchActive,
  wallElapsedMs,
  sessionEvent,
  streamError,
  pollPhaseHint,
  activeJobPollLoading,
  inClaudePhase,
}: ProgressCardProps) {
  return (
    <div
      className="space-y-2 rounded-lg border bg-muted/30 p-4"
      role="status"
      aria-live="polite"
      aria-label="Generation progress"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <ProgressHeader barPercent={barPercent} />
        <ElapsedDisplay wallElapsedMs={wallElapsedMs} sessionEvent={sessionEvent} />
      </div>
      {sessionEvent?.phase ? (
        <p className="text-sm leading-snug text-foreground">{sessionEvent.phase}</p>
      ) : batchActive ? (
        <div className="space-y-1">
          {streamError ? (
            <p className="text-sm leading-snug text-amber-800 dark:text-amber-100">{streamError}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {pollPhaseHint ?? (activeJobPollLoading ? "Fetching job status…" : "Connecting to progress stream…")}
          </p>
        </div>
      ) : null}
      {inClaudePhase ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Claude is generating many posts; this step often takes 1–3 minutes. The timer above keeps moving while you wait.
        </p>
      ) : null}
      <Progress value={barPercent} className={cn("h-2.5", inClaudePhase && "[&>div]:animate-pulse")} />
    </div>
  );
}

function ProgressHeader({ barPercent }: { barPercent: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{Math.round(barPercent)}%</span>
      <span className="text-sm text-muted-foreground">complete</span>
    </div>
  );
}

function ElapsedDisplay({
  wallElapsedMs,
  sessionEvent,
}: {
  wallElapsedMs: number;
  sessionEvent: JobProgressEvent | null;
}) {
  return (
    <div className="text-right text-sm tabular-nums text-muted-foreground">
        <div>
        <span className="font-medium text-foreground">Elapsed</span> {formatDuration(wallElapsedMs)}
      </div>
      {sessionEvent?.elapsedMs != null && sessionEvent.elapsedMs > 0 ? (
        <div className="text-xs">Worker step time {formatDuration(sessionEvent.elapsedMs)}</div>
      ) : null}
    </div>
  );
}
