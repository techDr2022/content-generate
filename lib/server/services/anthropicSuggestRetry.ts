import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AnthropicError,
  RateLimitError,
} from "@anthropic-ai/sdk";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short suggest-style calls: retry on rate limits, overload (529), and transient server/network errors. */
export function isRetryableAnthropicSuggestError(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof APIConnectionError) return true;
  if (err instanceof APIConnectionTimeoutError) return true;
  if (err instanceof AnthropicError && typeof (err as AnthropicError & { status?: number }).status === "number") {
    const status = (err as AnthropicError & { status?: number }).status;
    if (status === 429 || status === 408 || status === 529) return true;
    if (status != null && status >= 500) return true;
  }
  return false;
}

export const ANTHROPIC_SUGGEST_MAX_ATTEMPTS = 6;

export function anthropicSuggestBackoffMs(attempt: number, err: unknown): number {
  const rateLimited = err instanceof RateLimitError;
  const overloaded =
    err instanceof AnthropicError &&
    typeof (err as AnthropicError & { status?: number }).status === "number" &&
    (err as AnthropicError & { status?: number }).status === 529;
  const base = rateLimited || overloaded ? 2000 : 600;
  return Math.min(45_000, base * 2 ** (attempt - 1));
}
