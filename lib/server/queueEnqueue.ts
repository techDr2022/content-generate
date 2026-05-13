import type { JobsOptions, Queue } from "bullmq";
import type { GenerateJobPayload } from "@/lib/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRedisOrNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err as NodeJS.ErrnoException).code ?? ""}` : String(err);
  return /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|Connection is closed|READONLY|Broken pipe|Command timed out|Socket closed|MOVED|ASK|LOADING|BUSY|Redis|WRONGTYPE|OOM/i.test(
    msg
  );
}

/**
 * BullMQ `queue.add` can fail briefly when Redis blips. Retry a few times before surfacing.
 */
export async function addGenerateJobWithRetry(
  queue: Queue<GenerateJobPayload>,
  data: GenerateJobPayload,
  opts: JobsOptions,
  maxAttempts = 6
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await queue.add("generate-calendar", data, opts);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts || !isTransientRedisOrNetworkError(e)) {
        throw e;
      }
      const backoff = Math.min(4000, 250 * 2 ** (attempt - 1));
      await sleep(backoff);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
