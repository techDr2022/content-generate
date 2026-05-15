"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { CalendarPreview } from "@/components/calendar/CalendarPreview";
import { DownloadCard } from "@/components/export/DownloadCard";
import { SendReviewSessionDialog } from "@/components/review/SendReviewSessionDialog";
import { useJob, useJobCalendarRows } from "@/hooks/useGenerator";
import type { CalendarPost } from "@/lib/types";
import { useState } from "react";

export function JobCalendarViewPage(): JSX.Element {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const job = useJob(jobId);
  const rowsQuery = useJobCalendarRows(job.data?.status === "done" ? jobId : undefined);
  const [sendOpen, setSendOpen] = useState(false);

  const rows = (rowsQuery.data ?? []) as CalendarPost[];

  if (job.isLoading) {
    return (
      <PageWrapper title="Calendar" description="Loading job…">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageWrapper>
    );
  }

  if (job.isError || !job.data) {
    return (
      <PageWrapper title="Calendar" description="Job not found or inaccessible.">
        <Button variant="outline" asChild>
          <Link href="/jobs">Back to job history</Link>
        </Button>
      </PageWrapper>
    );
  }

  const j = job.data;
  const clientName = j.client?.name ?? "Client";

  if (j.status !== "done") {
    return (
      <PageWrapper
        title={`Job ${j.month}/${j.year}`}
        description="Only completed jobs have a workbook preview here."
        actions={
          <Button variant="outline" asChild>
            <Link href="/jobs">Back to job history</Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          This job is <strong>{j.status}</strong>. Open it again when status is <strong>done</strong>, or use Job history to
          monitor progress.
        </p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title={`${clientName} · ${j.month}/${j.year}`}
      description="Preview the generated calendar, download Excel to edit copy if needed, then send a secure client review link when you are ready."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/jobs">Job history</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/clients/${j.clientId}`}>Client calendars</Link>
          </Button>
          <Button type="button" onClick={() => setSendOpen(true)}>
            Send to client for review
          </Button>
        </div>
      }
    >
      {rowsQuery.isError ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Could not load preview."}
        </p>
      ) : null}

      <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="min-w-0 shrink-0 lg:sticky lg:top-16 lg:w-[min(100%,280px)] lg:self-start">
          <DownloadCard className="w-full" jobId={j.id} clientName={clientName} month={j.month} year={j.year} />
        </aside>
        <div className="min-w-0 flex-1 space-y-4">
          {rows.length > 0 ? (
            <CalendarPreview rows={rows} />
          ) : rowsQuery.isLoading ? (
            <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
              Loading calendar rows…
            </p>
          ) : (
            <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
              No rows returned for this workbook.
            </p>
          )}
        </div>
      </div>

      <SendReviewSessionDialog open={sendOpen} onOpenChange={setSendOpen} calendarId={j.id} />
    </PageWrapper>
  );
}
