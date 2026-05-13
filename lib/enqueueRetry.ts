import axios from "axios";
import type { ApiResponse } from "@/lib/api";

const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries transient gateway / network failures when calling POST /api/generate*.
 */
export async function postEnqueueWithRetry<T>(
  post: () => Promise<{ data: ApiResponse<T> }>,
  maxAttempts = 4
): Promise<{ data: ApiResponse<T> }> {
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await post();
    } catch (e) {
      last = e;
      const ax = axios.isAxiosError(e);
      const status = ax ? e.response?.status : undefined;
      const retryable =
        attempt < maxAttempts &&
        ax &&
        (!e.response || status === undefined || status >= 502 || status === 429);
      if (retryable) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      throw e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export { DEFAULT_TIMEOUT_MS as ENQUEUE_TIMEOUT_MS };
