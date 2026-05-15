"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineEditCaption } from "@/components/review/InlineEditCaption";
import { HashtagEditor } from "@/components/review/HashtagEditor";
import { RejectionDrawer } from "@/components/review/RejectionDrawer";
import { PostLightbox } from "@/components/review/PostLightbox";
import { cn } from "@/lib/utils";
import type { ReviewContentData } from "@/lib/reviewClientFetch";

type PostRow = ReviewContentData["posts"][number];

function borderClass(status: string | undefined): string {
  switch (status) {
    case "APPROVED":
      return "border-emerald-400 ring-1 ring-emerald-100";
    case "APPROVED_WITH_EDITS":
      return "border-amber-400 ring-1 ring-amber-100";
    case "REJECTED":
      return "border-rose-500 ring-1 ring-rose-100";
    default:
      return "border-slate-200";
  }
}

interface PostCardProps {
  post: PostRow;
  disabled: boolean;
  onSaveFeedback: (payload: {
    status: "APPROVED" | "APPROVED_WITH_EDITS" | "REJECTED" | "PENDING";
    editedCaption?: string | null;
    editedHashtags?: string | null;
    rejectionReason?: string | null;
    clientNote?: string | null;
  }) => Promise<void>;
}

export function PostCard({ post, disabled, onSaveFeedback }: PostCardProps): JSX.Element {
  const [lightbox, setLightbox] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(post.feedback?.rejectionReason ?? "");
  const [busy, setBusy] = useState(false);

  const status = post.feedback?.status ?? "PENDING";
  const displayCaption = post.feedback?.editedCaption ?? post.caption;
  const displayHashtags = post.feedback?.editedHashtags ?? post.hashtags;

  const typeBadge = useMemo(() => post.type, [post.type]);

  const st = status;

  function statusAfterTextEdit(): "PENDING" | "APPROVED_WITH_EDITS" {
    if (st === "REJECTED") return "PENDING";
    if (st === "APPROVED" || st === "APPROVED_WITH_EDITS") return "APPROVED_WITH_EDITS";
    return "PENDING";
  }

  async function patch(p: {
    status: "APPROVED" | "APPROVED_WITH_EDITS" | "REJECTED" | "PENDING";
    editedCaption?: string | null;
    editedHashtags?: string | null;
    rejectionReason?: string | null;
    clientNote?: string | null;
  }): Promise<void> {
    setBusy(true);
    try {
      await onSaveFeedback(p);
      if (p.status !== "REJECTED") {
        setRejectOpen(false);
        setRejectReason("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className={cn("overflow-hidden border-2 shadow-sm transition-colors", borderClass(status))}>
        <button
          type="button"
          className="relative block w-full bg-slate-100 text-left"
          onClick={() => setLightbox(true)}
          disabled={!post.posterUrl}
        >
          {post.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.posterUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
              No poster yet
            </div>
          )}
        </button>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{post.date}</span>
            <Badge variant="secondary" className="text-xs">
              {typeBadge}
            </Badge>
            {post.specialDay ? (
              <Badge variant="outline" className="text-xs">
                {post.specialDay}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caption</p>
            <InlineEditCaption
              value={displayCaption}
              disabled={disabled}
              onSave={(next) =>
                void patch({
                  status: statusAfterTextEdit(),
                  editedCaption: next,
                  editedHashtags: displayHashtags,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hashtags</p>
            <HashtagEditor
              value={displayHashtags}
              disabled={disabled}
              onSave={(next) =>
                void patch({
                  status: statusAfterTextEdit(),
                  editedCaption: displayCaption,
                  editedHashtags: next,
                })
              }
            />
          </div>
          {!disabled ? (
            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={status === "APPROVED" ? "default" : "outline"}
                  className="gap-1"
                  disabled={busy}
                  onClick={() =>
                    void patch({
                      status: "APPROVED",
                      editedCaption: null,
                      editedHashtags: null,
                      rejectionReason: null,
                    })
                  }
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={status === "APPROVED_WITH_EDITS" ? "default" : "outline"}
                  className="gap-1"
                  disabled={busy}
                  onClick={() =>
                    void patch({
                      status: "APPROVED_WITH_EDITS",
                      editedCaption: displayCaption,
                      editedHashtags: displayHashtags,
                      rejectionReason: null,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" /> Approve with edits
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={status === "REJECTED" ? "destructive" : "outline"}
                  className="gap-1 border-rose-200 text-rose-800 hover:bg-rose-50"
                  disabled={busy}
                  onClick={() => {
                    setRejectOpen(true);
                    if (status !== "REJECTED") setRejectReason("");
                  }}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
              <RejectionDrawer open={rejectOpen} value={rejectReason} onChange={setRejectReason} disabled={busy} />
              {rejectOpen ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() =>
                    void patch({
                      status: "REJECTED",
                      editedCaption: displayCaption,
                      editedHashtags: displayHashtags,
                      rejectionReason: rejectReason.trim(),
                    })
                  }
                >
                  Confirm reject
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <PostLightbox open={lightbox} onOpenChange={setLightbox} src={post.posterUrl} alt={`Poster ${post.date}`} />
    </>
  );
}
