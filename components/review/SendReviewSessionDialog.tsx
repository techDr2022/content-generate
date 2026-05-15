"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, getApiErrorMessage } from "@/lib/api";

function isLikelyValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

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
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reviewUrl: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setErr(null);
      setSuccess(null);
      setCopied(false);
    }
  }, [open, calendarId]);

  const emailTrim = email.trim();
  const emailBlocking =
    emailTrim.length > 0 && !isLikelyValidEmail(emailTrim);

  const sendReview = useMutation({
    mutationFn: async () => {
      if (!calendarId) throw new Error("Missing calendar");
      const res = await api.post<{
        success: boolean;
        data?: { sessionId: string; reviewUrl: string; expiresAt: string };
        error?: string;
      }>("/api/review/sessions", {
        calendarId,
        ...(emailTrim.length > 0 ? { email: emailTrim } : {}),
      });
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

  function handleClose(openNext: boolean): void {
    if (!openNext) {
      setSuccess(null);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{success ? "Review link ready" : "Send for review"}</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Share this link with your client (for example in WhatsApp). The link signs them in—no separate PIN
              needed when they open it from here.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={success.reviewUrl} className="font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {new Date(success.expiresAt).toLocaleString()}
              {emailTrim.length > 0 ? " · We also emailed the invite." : null}
            </p>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <div>
              <Label htmlFor="send-review-email">Client email (optional)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Just need a link to share in WhatsApp? Leave this blank—we will show a copyable link on the next
                step. Add an email if you want the invite sent automatically too.
              </p>
              <Input
                id="send-review-email"
                type="email"
                className="mt-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@clinic.com"
                autoComplete="email"
              />
            </div>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
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
                Cancel
              </Button>
              <Button
                type="button"
                disabled={sendReview.isPending || emailBlocking || !calendarId}
                onClick={() => void sendReview.mutateAsync()}
              >
                {sendReview.isPending ? "Creating…" : emailTrim.length > 0 ? "Email invite & create link" : "Create link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
