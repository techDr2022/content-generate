"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyReviewSession } from "@/lib/reviewClientFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ReviewAuthInner({ sessionId }: { sessionId: string }): JSX.Element {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await verifyReviewSession(sessionId, token, null);
        if (!cancelled) router.replace(`/review/${sessionId}/calendar`);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Link could not be verified.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sessionId, router]);

  async function onPinSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErr(null);
    try {
      setLoading(true);
      await verifyReviewSession(sessionId, null, pin.replace(/\D/g, "").slice(0, 6));
      router.replace(`/review/${sessionId}/calendar`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not verify PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Content review</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {token && loading
            ? "Verifying your secure link…"
            : "Enter the 6-digit PIN from your email if you are not using the review button."}
        </p>
        {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
        {!token || err ? (
          <form className="mt-6 space-y-4" onSubmit={(e) => void onPinSubmit(e)}>
            <div>
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                className="mt-1 tracking-widest"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || pin.length !== 6}>
              {loading ? "Checking…" : "Continue"}
            </Button>
          </form>
        ) : null}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">This portal is separate from the agency dashboard.</p>
    </div>
  );
}

export function ReviewAuthGate({ sessionId }: { sessionId: string }): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
      }
    >
      <ReviewAuthInner sessionId={sessionId} />
    </Suspense>
  );
}
