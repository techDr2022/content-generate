"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, getApiErrorMessage } from "@/lib/api";

export interface SendReviewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Completed generation job id (= calendar id for review API). */
  calendarId: string | null;
  onSent?: () => void;
}

export function SendReviewSessionDialog({
  open,
  onOpenChange,
  calendarId,
  onSent,
}: SendReviewSessionDialogProps): JSX.Element {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reviewUrl: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const sendReview = useMutation({
    mutationFn: async () => {
      if (!calendarId) throw new Error("Missing calendar");
      const res = await api.post<{
        success: boolean;
        data?: { sessionId: string; reviewUrl: string; expiresAt: string };
        error?: string;
      }>("/api/review/sessions", { calendarId });
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Failed to create session");
      }
      return res.data.data;
    },
    onSuccess: async (data) => {
      setSuccess({ reviewUrl: data.reviewUrl, expiresAt: data.expiresAt });
      setErr(null);
      await qc.invalidateQueries({ queryKey: ["review-active-count"] });
      await qc.invalidateQueries({ queryKey: ["review-sessions"] });
      onSent?.();
    },
    onError: (e) => {
      setErr(getApiErrorMessage(e));
    },
  });

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSuccess(null);
    setCopied(false);
    if (calendarId) {
      void sendReview.mutate();
    }
  }, [open, calendarId]);

  function handleClose(openNext: boolean): void {
    if (!openNext) {
      setSuccess(null);
      sendReview.reset();
    }
    onOpenChange(openNext);
  }

  async function copyLink(): Promise<void> {
    if (!success?.reviewUrl) return;
    try {
      await navigator.clipboard.writeText(success.reviewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Could not copy to clipboard.");
    }
  }

  const loading = sendReview.isPending && !success;
  const title = success ? "Review link ready" : loading ? "Creating review link…" : "Share review link";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">
            Generating a link you can copy and send to your client.
          </p>
        ) : success ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Copy this link and send it to your client (for example in WhatsApp). Opening the link signs them in—no
              separate PIN needed.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={success.reviewUrl} className="font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expires {new Date(success.expiresAt).toLocaleString()}</p>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">{err ?? "Could not create a review link. Try again."}</p>
          </div>
        )}
        <DialogFooter>
          {success ? (
            <Button type="button" onClick={() => handleClose(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                {loading ? "Cancel" : "Close"}
              </Button>
              {!loading && !success ? (
                <Button type="button" disabled={!calendarId} onClick={() => void sendReview.mutate()}>
                  Try again
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
