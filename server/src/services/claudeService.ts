import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AnthropicError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { CalendarPost } from "@hc/shared";
import { logger } from "../lib/logger";

/** Default Messages API model (see https://docs.anthropic.com/en/docs/about-claude/models/overview). */
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";
/** Full monthly calendars need room for long captions + JSON structure (min 4000). */
const _envMax = Number.parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? "", 10);
const MAX_TOKENS =
  Number.isFinite(_envMax) && _envMax >= 4000 ? _envMax : 8000;

function claudeModel(): string {
  const fromEnv = process.env.ANTHROPIC_MODEL?.trim();
  return fromEnv || DEFAULT_CLAUDE_MODEL;
}

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "");
    text = text.replace(/\s*```$/i, "");
  }
  return text.trim();
}

/** Claude often prefixes JSON with a short sentence — extract the array/object payload. */
function parseJsonArrayFromClaudeText(raw: string): unknown {
  const cleaned = stripMarkdownFences(raw);
  const arrStart = cleaned.indexOf("[");
  const objStart = cleaned.indexOf("{");
  let start = -1;
  if (arrStart !== -1 && objStart !== -1) {
    start = Math.min(arrStart, objStart);
  } else if (arrStart !== -1) {
    start = arrStart;
  } else if (objStart !== -1) {
    start = objStart;
  }
  if (start === -1) {
    throw new Error("No JSON array or object found in Claude response");
  }
  const jsonSlice = cleaned.slice(start);
  return JSON.parse(jsonSlice) as unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CLAUDE_MAX_ATTEMPTS = 6;

/** Single HTTP attempt timeout (SDK default is 10m and retries multiply wall-clock wait). */
function anthropicHttpTimeoutMs(): number {
  const raw = Number.parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return 360_000;
}

function isRetryableAnthropicError(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof APIConnectionError) return true;
  if (err instanceof APIConnectionTimeoutError) return true;
  if (err instanceof AnthropicError && typeof (err as AnthropicError & { status?: number }).status === "number") {
    const status = (err as AnthropicError & { status?: number }).status;
    if (status === 429 || status === 408) return true;
    if (status != null && status >= 500) return true;
  }
  return false;
}

export async function generateCalendarWithClaude(
  system: string,
  user: string
): Promise<CalendarPost[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const httpTimeoutMs = anthropicHttpTimeoutMs();
  /** Disable SDK auto-retries — `CLAUDE_MAX_ATTEMPTS` already retries with backoff (otherwise each "attempt" can run 3× HTTP internally). */
  const client = new Anthropic({ apiKey, timeout: httpTimeoutMs, maxRetries: 0 });
  const model = claudeModel();
  let lastError: unknown;

  for (let attempt = 1; attempt <= CLAUDE_MAX_ATTEMPTS; attempt++) {
    try {
      const started = Date.now();
      logger.info("Claude API request starting", {
        model,
        attempt,
        timeoutMs: httpTimeoutMs,
        max_tokens: MAX_TOKENS,
      });
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      });
      logger.info("Claude API response received", {
        model,
        attempt,
        elapsedMs: Date.now() - started,
      });

      const usage = response.usage;
      logger.info("Claude token usage", {
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        attempt,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      let parsed: unknown;
      try {
        parsed = parseJsonArrayFromClaudeText(textBlock.text);
      } catch (parseErr) {
        logger.error("Claude JSON parse failed — raw excerpt", {
          excerpt: textBlock.text.slice(0, 4000),
          parseErr,
        });
        throw parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      }
      if (!Array.isArray(parsed)) {
        throw new Error("Claude response is not a JSON array");
      }

      return parsed as CalendarPost[];
    } catch (err) {
      lastError = err;
      logger.warn("Claude call failed", { attempt, err });
      if (attempt >= CLAUDE_MAX_ATTEMPTS || !isRetryableAnthropicError(err)) {
        break;
      }
      const rateLimited = err instanceof RateLimitError;
      const base = rateLimited ? 2000 : 600;
      const backoff = Math.min(45_000, base * 2 ** (attempt - 1));
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
