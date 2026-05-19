import { useEffect, useState } from "react";

/** Updates once per second while `startedAt` is set; isolates timer re-renders from parent trees. */
export function useElapsedMs(startedAt: number | null, intervalMs = 1000): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startedAt == null) {
      setElapsedMs(0);
      return undefined;
    }
    const tick = (): void => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [startedAt, intervalMs]);

  return startedAt == null ? 0 : elapsedMs;
}
