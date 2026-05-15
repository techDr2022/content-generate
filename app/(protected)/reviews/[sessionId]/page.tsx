"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, getApiErrorMessage } from "@/lib/api";
import { SessionStatusBadge } from "@/components/review/SessionStatusBadge";
import { ReviewDiffViewer } from "@/components/review/ReviewDiffViewer";
import { ChevronDown, ChevronRight } from "lucide-react";

type Detail = {
  id: string;
  status: string;
  email: string | null;
  expiresAt: string;
  createdAt: string;
  submittedAt: string | null;
  reviewUrl: string;
  client: { clinicName: string; doctorName: string };
  calendar: { month: number; year: number };
  postFeedbacks: Array<{
    id: string;
    status: string;
    editedCaption: string | null;
    editedHashtags: string | null;
    rejectionReason: string | null;
    clientNote: string | null;
    post: {
      date: string;
      postType: string;
      caption: string;
      hashtags: string;
    };
  }>;
  sessionLogs: Array<{ id: string; event: string; createdAt: string; postId: string | null; metadata: unknown }>;
};

export default function ReviewSessionDetailPage(): JSX.Element {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["review-session-detail", sessionId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Detail }>(`/api/review/sessions/${sessionId}`);
      return res.data.data;
    },
  });

  const d = q.data;

  async function downloadExport(): Promise<void> {
    const res = await api.get(`/api/review/sessions/${sessionId}/export`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${sessionId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <PageWrapper
      title="Review session"
      description="Post-level feedback, exports, and activity for this client review round."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/reviews">Back</Link>
          </Button>
          {d?.reviewUrl ? (
            <Button type="button" variant="secondary" onClick={() => void navigator.clipboard.writeText(d.reviewUrl)}>
              Copy client link
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void downloadExport().catch((e) => alert(getApiErrorMessage(e)))}>
            Export Excel
          </Button>
          <Button
            type="button"
            onClick={async () => {
              try {
                await api.post(`/api/review/sessions/${sessionId}/resend`);
                void q.refetch();
              } catch (e) {
                alert(getApiErrorMessage(e));
              }
            }}
          >
            Resend / extend
          </Button>
        </div>
      }
    >
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {q.error ? <p className="text-sm text-destructive">{getApiErrorMessage(q.error)}</p> : null}
      {d ? (
        <div className="space-y-8">
          <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <SessionStatusBadge status={d.status} />
              <span>
                <span className="text-muted-foreground">Client:</span> {d.client.clinicName}
              </span>
              <span>
                <span className="text-muted-foreground">Calendar:</span> {d.calendar.month}/{d.calendar.year}
              </span>
              <span>
                <span className="text-muted-foreground">Sent to:</span>{" "}
                {d.email ?? <span className="text-muted-foreground">Link only (no email)</span>}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Expires {new Date(d.expiresAt).toLocaleString()} · Created {new Date(d.createdAt).toLocaleString()}
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Post feedback</h2>
            <div className="overflow-x-auto rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Edited caption</TableHead>
                    <TableHead>Rejection</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.postFeedbacks.flatMap((fb) => {
                    const open = openId === fb.id;
                    const main = (
                      <TableRow key={fb.id}>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setOpenId(open ? null : fb.id)}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>{fb.post.date}</TableCell>
                        <TableCell>{fb.post.postType}</TableCell>
                        <TableCell>
                          <SessionStatusBadge status={fb.status} />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{fb.editedCaption ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">{fb.rejectionReason ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-xs">{fb.clientNote ?? "—"}</TableCell>
                      </TableRow>
                    );
                    if (!open) return [main];
                    return [
                      main,
                      <TableRow key={`${fb.id}-diff`}>
                        <TableCell colSpan={7} className="bg-slate-50 text-xs">
                          <p className="mb-2 font-medium text-muted-foreground">Caption diff</p>
                          <ReviewDiffViewer original={fb.post.caption} edited={fb.editedCaption ?? fb.post.caption} />
                        </TableCell>
                      </TableRow>,
                    ];
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Activity</h2>
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {d.sessionLogs.map((log) => (
                <li key={log.id} className="text-sm">
                  <span className="font-medium">{log.event}</span>
                  <span className="text-muted-foreground"> · {new Date(log.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </PageWrapper>
  );
}
