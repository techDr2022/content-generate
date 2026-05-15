"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReviewContent, submitReviewSession, updatePostFeedback, type ReviewContentData } from "@/lib/reviewClientFetch";
import { PostCard } from "@/components/review/PostCard";
import { PostCardSkeleton } from "@/components/review/PostCardSkeleton";
import { ReviewProgressBar } from "@/components/review/ReviewProgressBar";
import { SubmitReviewModal } from "@/components/review/SubmitReviewModal";
import { Button } from "@/components/ui/button";

type Filter = "all" | "pending" | "approved" | "rejected";

function matchesFilter(p: ReviewContentData["posts"][number], f: Filter): boolean {
  const s = p.feedback?.status ?? "PENDING";
  if (f === "all") return true;
  if (f === "pending") return s === "PENDING";
  if (f === "approved") return s === "APPROVED" || s === "APPROVED_WITH_EDITS";
  if (f === "rejected") return s === "REJECTED";
  return true;
}

export default function ReviewCalendarPage(): JSX.Element {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["review-content", sessionId],
    queryFn: () => fetchReviewContent(sessionId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async ({
      postId,
      body,
    }: {
      postId: string;
      body: Record<string, unknown>;
    }) => {
      return updatePostFeedback(sessionId, postId, body);
    },
    onMutate: async ({ postId, body }) => {
      await qc.cancelQueries({ queryKey: ["review-content", sessionId] });
      const previous = qc.getQueryData<ReviewContentData>(["review-content", sessionId]);
      if (!previous) return { previous };
      qc.setQueryData<ReviewContentData>(["review-content", sessionId], (old) => {
        if (!old) return old;
        const posts = old.posts.map((p) => {
          if (p.id !== postId) return p;
          const nextFb = {
            ...(p.feedback ?? { id: "temp", status: "PENDING" }),
            ...body,
          };
          return { ...p, feedback: nextFb as typeof p.feedback };
        });
        const total = old.posts.length;
        let pending = 0;
        let approved = 0;
        let approvedWithEdits = 0;
        let rejected = 0;
        for (const p of posts) {
          const s = (p.feedback?.status as string) ?? "PENDING";
          if (s === "PENDING") pending++;
          else if (s === "APPROVED") approved++;
          else if (s === "APPROVED_WITH_EDITS") approvedWithEdits++;
          else if (s === "REJECTED") rejected++;
        }
        const stats = { total, pending, approved, approvedWithEdits, rejected };
        return { ...old, posts, stats };
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["review-content", sessionId], ctx.previous);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["review-content", sessionId] });
    },
  });

  const submitMut = useMutation({
    mutationFn: () => submitReviewSession(sessionId),
    onSuccess: () => {
      router.replace(`/review/${sessionId}/submitted`);
    },
  });

  const filtered = useMemo(() => (data?.posts ?? []).filter((p) => matchesFilter(p, filter)), [data, filter]);
  const disabled = data?.sessionStatus === "SUBMITTED";
  const reviewed =
    (data?.stats.approved ?? 0) + (data?.stats.approvedWithEdits ?? 0) + (data?.stats.rejected ?? 0);
  const total = data?.stats.total ?? 0;
  const canSubmit = data && data.stats.pending === 0 && total > 0 && !disabled;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load review."}</p>
        <Button className="mt-4" variant="outline" onClick={() => router.replace(`/review/${sessionId}`)}>
          Back to sign-in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Client review</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{data?.calendar.clientName ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.calendar.month} {data?.calendar.year}
          </p>
        </div>
        <div className="w-full max-w-md space-y-3">
          <ReviewProgressBar reviewed={reviewed} total={total || 1} />
          <Button className="w-full md:w-auto" disabled={!canSubmit || submitMut.isPending} onClick={() => setSubmitOpen(true)}>
            Submit review
          </Button>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)
          : filtered.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                disabled={Boolean(disabled)}
                onSaveFeedback={async (payload) => {
                  await mutation.mutateAsync({ postId: p.id, body: payload });
                }}
              />
            ))}
      </div>

      <SubmitReviewModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        pending={submitMut.isPending}
        stats={{
          approved: data?.stats.approved ?? 0,
          approvedWithEdits: data?.stats.approvedWithEdits ?? 0,
          rejected: data?.stats.rejected ?? 0,
          total: data?.stats.total ?? 0,
        }}
        onConfirm={() => void submitMut.mutateAsync()}
      />
    </div>
  );
}
