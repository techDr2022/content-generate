import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AnthropicError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { HttpError } from "@/lib/server/http";

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

function anthropicStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/** Inner API message, without the SDK's `400 {"type":"error"...}` wrapper. */
export function anthropicApiMessage(err: unknown): string {
  if (err && typeof err === "object" && "error" in err) {
    const body = (err as { error?: unknown }).error;
    if (body && typeof body === "object" && "error" in body) {
      const message = (body as { error?: { message?: unknown } }).error?.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Anthropic request failed";
}

/** Map a failed Claude suggest call to a status and a message the UI can show. */
export function anthropicSuggestHttpError(err: unknown, action: string): HttpError {
  const msg = anthropicApiMessage(err);
  const status = anthropicStatus(err);
  if (msg.includes("ANTHROPIC_API_KEY")) {
    return new HttpError(503, "ANTHROPIC_API_KEY is not configured.");
  }
  if (/credit balance|purchase credits|plans & billing/i.test(msg)) {
    return new HttpError(
      402,
      "Anthropic credit balance is too low. Add credits under Plans & Billing in the Anthropic console, then try again."
    );
  }
  if (status === 429 || status === 529 || /overloaded|rate[_ ]limit/i.test(msg)) {
    return new HttpError(
      503,
      "Anthropic is temporarily overloaded or rate-limited. Wait 30–60 seconds and try again."
    );
  }
  return new HttpError(502, `Could not ${action}: ${msg}`);
}

export function anthropicSuggestBackoffMs(attempt: number, err: unknown): number {
  const rateLimited = err instanceof RateLimitError;
  const overloaded =
    err instanceof AnthropicError &&
    typeof (err as AnthropicError & { status?: number }).status === "number" &&
    (err as AnthropicError & { status?: number }).status === 529;
  const base = rateLimited || overloaded ? 2000 : 600;
  return Math.min(45_000, base * 2 ** (attempt - 1));
}
