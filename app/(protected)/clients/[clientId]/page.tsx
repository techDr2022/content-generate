"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendReviewSessionDialog } from "@/components/review/SendReviewSessionDialog";
import { useJobs } from "@/hooks/useJobs";
import { useClients } from "@/hooks/useClients";
import { api } from "@/lib/api";

function useActiveReviewCount(calendarId: string | undefined) {
  return useQuery({
    enabled: Boolean(calendarId),
    queryKey: ["review-active-count", calendarId],
    queryFn: async () => {
      const qs = new URLSearchParams({
        calendarId: calendarId!,
        activeOnly: "true",
        limit: "1",
        page: "1",
      });
      const res = await api.get<{ success: boolean; data: { total: number } }>(`/api/review/sessions?${qs.toString()}`);
      return res.data.data?.total ?? 0;
    },
  });
}

export default function ClientCalendarsPage(): JSX.Element {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const jobs = useJobs();
  const clients = useClients();

  const client = useMemo(() => clients.data?.find((c) => c.id === clientId), [clients.data, clientId]);
  const doneJobs = useMemo(
    () => (jobs.data ?? []).filter((j) => j.clientId === clientId && j.status === "done"),
    [jobs.data, clientId]
  );

  const [dialogJobId, setDialogJobId] = useState<string | null>(null);

  return (
    <PageWrapper
      title={client ? client.clinicName : "Client"}
      description="Completed calendars for this client. View the calendar, download Excel to edit, or send a secure review link."
      actions={
        <Button variant="outline" asChild>
          <Link href="/clients">Back to clients</Link>
        </Button>
      }
    >
      {!client ? (
        <p className="text-sm text-muted-foreground">Client not found or still loading.</p>
      ) : (
        <div className="space-y-4">
          {doneJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed generation jobs for this client yet.</p>
          ) : (
            <ul className="space-y-3">
              {doneJobs.map((j) => (
                <JobReviewRow
                  key={j.id}
                  jobId={j.id}
                  label={`${j.year}-${String(j.month).padStart(2, "0")} · ${j.postCount} posts`}
                  onSend={() => setDialogJobId(j.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <SendReviewSessionDialog
        open={dialogJobId !== null}
        onOpenChange={(open) => {
          if (!open) setDialogJobId(null);
        }}
        calendarId={dialogJobId}
      />
    </PageWrapper>
  );
}

function JobReviewRow({
  jobId,
  label,
  onSend,
}: {
  jobId: string;
  label: string;
  onSend: () => void;
}): JSX.Element {
  const q = useActiveReviewCount(jobId);
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-xs text-muted-foreground">Job id: {jobId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {typeof q.data === "number" && q.data > 0 ? (
          <Badge variant="secondary">{q.data} active review{q.data === 1 ? "" : "s"}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">No active reviews</span>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/jobs/${jobId}/view`}>View</Link>
        </Button>
        <Button size="sm" onClick={onSend}>
          Send for review
        </Button>
      </div>
    </li>
  );
}
