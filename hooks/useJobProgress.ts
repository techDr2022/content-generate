import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { openJobStream } from "@/lib/sse";
import type { JobProgressEvent } from "@/lib/types";

export function useJobProgress(userId: string | undefined) {
  const qc = useQueryClient();
  const [lastEvent, setLastEvent] = useState<JobProgressEvent | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const es = openJobStream(userId, token, (raw) => {
      if (!raw || typeof raw !== "object") return;
      const envelope = raw as { success?: boolean; data?: unknown };
      if (!envelope.success || !envelope.data) return;
      const data = envelope.data as JobProgressEvent | { connected?: boolean };
      if ("connected" in data && data.connected) return;
      const evt = data as JobProgressEvent;
      setLastEvent(evt);
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    });
    return () => {
      es.close();
    };
  }, [userId, qc]);

  return { lastEvent };
}
