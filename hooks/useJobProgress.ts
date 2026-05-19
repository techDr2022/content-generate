import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openJobStream } from "@/lib/sse";
import type { JobProgressEvent } from "@/lib/types";

/**
 * @param streamSessionKey Increment when a new generate batch is queued so we drop stale SSE
 *   `lastEvent` (e.g. a previous job's "done") and open a fresh EventSource — otherwise the UI
 *   can sit on "Connecting to progress stream…" while the worker runs.
 */
export function useJobProgress(userId: string | undefined, streamSessionKey?: number) {
  const qc = useQueryClient();
  const [lastEvent, setLastEvent] = useState<JobProgressEvent | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    setLastEvent(null);
  }, [streamSessionKey, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    setStreamError(null);
    const es = openJobStream(userId, token, (raw) => {
      if (!raw || typeof raw !== "object") return;
      const envelope = raw as { success?: boolean; data?: unknown };
      if (!envelope.success || !envelope.data) return;
      const data = envelope.data as JobProgressEvent | { connected?: boolean };
      if ("connected" in data && data.connected) return;
      const evt = data as JobProgressEvent;
      setLastEvent(evt);
      if (evt.status === "done" || evt.status === "failed" || evt.status === "cancelled") {
        void qc.invalidateQueries({ queryKey: ["jobs"] });
      }
    });
    es.onerror = () => {
      setStreamError(
        "Live progress stream interrupted (browser cannot set SSE headers). The job may still be running — check the Jobs page or wait for the download card."
      );
    };
    return () => {
      es.close();
    };
  }, [userId, qc, streamSessionKey]);

  return { lastEvent, streamError };
}
