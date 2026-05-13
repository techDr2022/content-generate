"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { GeneratorForm } from "@/components/generator/GeneratorForm";
import type { RunSpecialDay } from "@/components/generator/SpecialDaysInput";
import { ExportButton } from "@/components/export/ExportButton";
import { DownloadCard } from "@/components/export/DownloadCard";
import { CalendarPreview } from "@/components/calendar/CalendarPreview";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
import { useCancelJob, useEnqueueGenerate, useJobPreview, useSuggestSpecialDays } from "@/hooks/useGenerator";
import { useEnqueueBulkGenerate } from "@/hooks/useBulkExport";
import { useJobProgress } from "@/hooks/useJobProgress";
import { formatDuration } from "@/lib/formatDuration";
import { cn } from "@/lib/utils";
import type { CalendarPost } from "@/lib/types";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Merge AI-picked + manual special days; same calendar date: manual overwrites. */
function mergeRunSpecialDays(
  manual: RunSpecialDay[],
  aiRows: RunSpecialDay[],
  aiSelected: boolean[]
): RunSpecialDay[] {
  const fromAi = aiRows.filter((_, i) => aiSelected[i] === true);
  const map = new Map<string, RunSpecialDay>();
  for (const r of fromAi) {
    if (r.label && r.date) map.set(r.date, r);
  }
  for (const r of manual) {
    if (r.label && r.date) map.set(r.date, r);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function enqueueErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.response?.status === 503) {
      return "Server could not reach Redis or the job queue. Check REDIS_URL, then try again.";
    }
    if (err.response?.status) return `Request failed (${err.response.status}).`;
  }
  if (err instanceof Error) return err.message;
  return "Could not start generation. Please try again.";
}

export function GeneratorPage() {
  const clients = useClients();
  const enqueueSingle = useEnqueueGenerate();
  const enqueueBulk = useEnqueueBulkGenerate();
  const cancelJob = useCancelJob();
  const suggestSpecialDays = useSuggestSpecialDays();

  const user = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { id: string; name: string };
    } catch {
      return null;
    }
  }, []);

  const { lastEvent } = useJobProgress(user?.id);

  const [clientId, setClientId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [postOverride, setPostOverride] = useState<number | undefined>(undefined);
  const [manualSpecialDays, setManualSpecialDays] = useState<RunSpecialDay[]>([]);
  const [aiSuggestedDays, setAiSuggestedDays] = useState<RunSpecialDay[]>([]);
  const [aiSuggestedSelected, setAiSuggestedSelected] = useState<boolean[]>([]);
  const [sessionJobs, setSessionJobs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [completedIds, setCompletedIds] = useState(() => new Set<string>());
  const [, setTick] = useState(0);
  const [lastDone, setLastDone] = useState<{
    jobId: string;
    clientName: string;
    month: number;
    year: number;
  } | null>(null);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);

  const completedCount = completedIds.size;
  const batchActive =
    sessionJobs.length > 0 && completedCount < sessionJobs.length && runStartedAt !== null;

  const selectedClient = useMemo(
    () => clients.data?.find((c) => c.id === clientId),
    [clients.data, clientId]
  );

  useEffect(() => {
    if (!batchActive) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [batchActive]);

  useEffect(() => {
    if (!lastEvent || !sessionJobs.includes(lastEvent.jobId)) return;
    setProgress(lastEvent.progress);
    if (lastEvent.status === "done" || lastEvent.status === "failed" || lastEvent.status === "cancelled") {
      setCompletedIds((prev) => new Set(prev).add(lastEvent.jobId));
    }
    if (lastEvent.status === "done") {
      setLastDone({
        jobId: lastEvent.jobId,
        clientName: lastEvent.clientName,
        month: lastEvent.month ?? months[0] ?? 1,
        year: lastEvent.year ?? year,
      });
    }
  }, [lastEvent, sessionJobs, months, year]);

  const wallElapsedMs = runStartedAt ? Date.now() - runStartedAt : 0;
  const sessionEvent =
    lastEvent && sessionJobs.includes(lastEvent.jobId) ? lastEvent : null;
  const inClaudePhase =
    Boolean(sessionEvent?.phase?.includes("Claude")) &&
    sessionEvent &&
    sessionEvent.progress >= 35 &&
    sessionEvent.progress < 72;

  const currentJobIncomplete =
    sessionEvent !== null &&
    sessionEvent.status !== "done" &&
    sessionEvent.status !== "failed" &&
    sessionEvent.status !== "cancelled";
  const barPercent =
    sessionJobs.length <= 1
      ? progress
      : Math.min(
          100,
          Math.round(
            (completedCount * 100) / sessionJobs.length +
              (currentJobIncomplete && sessionEvent
                ? sessionEvent.progress / sessionJobs.length
                : 0)
          )
        );

  const preview = useJobPreview(lastDone?.jobId, Boolean(lastDone));
  const rows = (preview.data ?? []) as CalendarPost[];

  useEffect(() => {
    if (!clientId && clients.data?.length) {
      setClientId(clients.data[0]!.id);
    }
  }, [clients.data, clientId]);

  useEffect(() => {
    setPostOverride(undefined);
  }, [clientId]);

  useEffect(() => {
    setAiSuggestedDays([]);
    setAiSuggestedSelected([]);
  }, [clientId, year, months.join(",")]);

  function mergedExtraDays(): RunSpecialDay[] {
    return mergeRunSpecialDays(manualSpecialDays, aiSuggestedDays, aiSuggestedSelected);
  }

  /** Only days whose date falls in the given calendar month (for bulk jobs). */
  function extraDaysForCalendarMonth(targetMonth: number, targetYear: number): RunSpecialDay[] {
    const prefix = `${targetYear}-${pad2(targetMonth)}`;
    return mergedExtraDays().filter((r) => r.date.startsWith(prefix));
  }

  function handleAiSuggestedToggle(index: number, checked: boolean): void {
    setAiSuggestedSelected((prev) => {
      const next = [...prev];
      next[index] = checked;
      return next;
    });
  }

  function handleSuggestSpecialDays(): void {
    if (!clientId || months.length === 0) return;
    suggestSpecialDays.mutate(
      { clientId, month: months[0]!, year },
      {
        onSuccess: (data) => {
          setAiSuggestedDays(data);
          setAiSuggestedSelected(data.map(() => true));
        },
      }
    );
  }

  async function handleGenerate(): Promise<void> {
    if (!clientId) return;
    if (months.length === 0) {
      setEnqueueError("Select at least one month.");
      return;
    }
    setEnqueueError(null);
    setSessionJobs([]);
    setProgress(0);
    setLastDone(null);
    setCompletedIds(new Set());
    setRunStartedAt(null);
    setTick(0);
    const base = {
      clientId,
      year,
      postCountOverride: postOverride,
    };
    try {
      if (months.length === 1) {
        const job = await enqueueSingle.mutateAsync({
          ...base,
          month: months[0]!,
          extraSpecialDays: extraDaysForCalendarMonth(months[0]!, year),
        });
        setSessionJobs([job.id]);
      } else {
        const jobs = await enqueueBulk.mutateAsync(
          months.map((m) => ({
            ...base,
            month: m,
            extraSpecialDays: extraDaysForCalendarMonth(m, year),
          }))
        );
        setSessionJobs(jobs.map((j) => j.id));
      }
      setRunStartedAt(Date.now());
    } catch (err) {
      setEnqueueError(enqueueErrorMessage(err));
    }
  }

  async function handleStop(): Promise<void> {
    const pending = sessionJobs.filter((id) => !completedIds.has(id));
    if (pending.length === 0) return;
    await Promise.allSettled(pending.map((id) => cancelJob.mutateAsync(id)));
  }

  return (
    <PageWrapper
      title="Generator"
      description="Queue Claude-powered calendars per client and month. SSE keeps the UI synced with BullMQ workers."
    >
      <GeneratorForm
        clients={clients.data ?? []}
        clientId={clientId}
        onClientChange={setClientId}
        year={year}
        onYearChange={setYear}
        months={months}
        onMonthsChange={setMonths}
        postOverride={postOverride}
        onPostOverrideChange={setPostOverride}
        extraSpecialDays={manualSpecialDays}
        onExtraSpecialDaysChange={setManualSpecialDays}
        clientDefaultPosts={selectedClient?.postsPerMonth}
        clientLabel={selectedClient?.name}
        clientSpecialties={selectedClient?.specialty ?? []}
        suggestionMonth={months[0]}
        suggestionYear={year}
        aiSuggestedDays={aiSuggestedDays}
        aiSuggestedSelected={aiSuggestedSelected}
        onAiSuggestedToggle={handleAiSuggestedToggle}
        onSuggestSpecialDays={handleSuggestSpecialDays}
        suggestSpecialDaysLoading={suggestSpecialDays.isPending}
        suggestSpecialDaysError={
          suggestSpecialDays.error instanceof Error
            ? suggestSpecialDays.error.message
            : suggestSpecialDays.error
              ? String(suggestSpecialDays.error)
              : null
        }
        showSuggestedSpecialDays={months.length > 0}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ExportButton
          loading={enqueueSingle.isPending || enqueueBulk.isPending}
          onClick={() => void handleGenerate()}
          label="Generate"
        />
        {batchActive ? (
          <Button
            type="button"
            variant="outline"
            className="border-destructive/60 text-destructive hover:bg-destructive/10"
            disabled={cancelJob.isPending}
            onClick={() => void handleStop()}
          >
            {cancelJob.isPending ? "Stopping…" : "Stop"}
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {sessionJobs.length ? `${sessionJobs.length} job(s) queued` : "Jobs enqueue instantly; workers respect concurrency 3."}
          {batchActive ? " · Stop cancels queued work; if Claude is already running, it may finish the current API call." : ""}
        </span>
      </div>

      {sessionJobs.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Batch progress: {completedCount} / {sessionJobs.length} month(s) finished · live timer shows time since Generate.
        </p>
      ) : null}

      {enqueueError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {enqueueError}
        </p>
      ) : null}

      <div
        className="space-y-2 rounded-lg border bg-muted/30 p-4"
        role="status"
        aria-live="polite"
        aria-label="Generation progress"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{Math.round(barPercent)}%</span>
            <span className="text-sm text-muted-foreground">complete</span>
          </div>
          <div className="text-right text-sm tabular-nums text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Elapsed</span> {formatDuration(wallElapsedMs)}
            </div>
            {sessionEvent?.elapsedMs != null && sessionEvent.elapsedMs > 0 ? (
              <div className="text-xs">
                Worker step time {formatDuration(sessionEvent.elapsedMs)}
              </div>
            ) : null}
          </div>
        </div>
        {sessionEvent?.phase ? (
          <p className="text-sm leading-snug text-foreground">{sessionEvent.phase}</p>
        ) : batchActive ? (
          <p className="text-sm text-muted-foreground">
            {progress > 0
              ? "Processing… Claude usually needs 1–3 minutes for this step."
              : "Connecting to progress stream…"}
          </p>
        ) : null}
        {inClaudePhase ? (
          <p className="text-xs text-amber-800 dark:text-amber-200/90">
            Claude is generating many posts; this step often takes 1–3 minutes. The timer above keeps moving while you wait.
          </p>
        ) : null}
        <Progress
          value={barPercent}
          className={cn("h-2.5", inClaudePhase && "[&>div]:animate-pulse")}
        />
      </div>

      {lastEvent && sessionJobs.includes(lastEvent.jobId) && lastEvent.status === "failed" ? (
        <p className="text-sm text-red-600">Job failed: {lastEvent.errorMsg ?? "Unknown error"}</p>
      ) : null}
      {lastEvent && sessionJobs.includes(lastEvent.jobId) && lastEvent.status === "cancelled" ? (
        <p className="text-sm text-muted-foreground">Generation stopped before completion.</p>
      ) : null}

      {lastDone ? (
        <div className="grid gap-4 md:grid-cols-2">
          <DownloadCard
            jobId={lastDone.jobId}
            clientName={lastDone.clientName}
            month={lastDone.month}
            year={lastDone.year}
          />
          {rows.length > 0 ? <CalendarPreview rows={rows} /> : null}
        </div>
      ) : null}
    </PageWrapper>
  );
}