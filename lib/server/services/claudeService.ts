import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AnthropicError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { CalendarPost } from "@/lib/types";
import { logger } from "../logger";

/** Default Messages API model — override with ANTHROPIC_MODEL in env. */
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";
/** Full monthly calendars need room for long `supportingText` + JSON — default raised to reduce mid-JSON truncation. */
const _envMax = Number.parseInt(process.env.ANTHROPIC_MAX_TOKENS ?? "", 10);
/** When unset, use a generous default; override with ANTHROPIC_MAX_TOKENS if the API rejects the value for your model. */
const DEFAULT_MAX_TOKENS = 64_000;
const MAX_TOKENS =
  Number.isFinite(_envMax) && _envMax >= 4000 ? Math.min(_envMax, 128_000) : DEFAULT_MAX_TOKENS;

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
export function parseJsonArrayFromClaudeText(raw: string): unknown {
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
  try {
    return JSON.parse(jsonSlice) as unknown;
  } catch (e) {
    if (e instanceof SyntaxError) {
      const posMatch = /position (\d+)/i.exec(e.message);
      const pos = posMatch ? Number.parseInt(posMatch[1]!, 10) : NaN;
      const hint =
        Number.isFinite(pos) && pos > 0
          ? ` Near character ${pos} of extracted JSON (snippet): ${jsonSlice.slice(Math.max(0, pos - 80), Math.min(jsonSlice.length, pos + 80))}`
          : "";
      throw new SyntaxError(
        `${e.message}.${hint} If this says "Unterminated string", the model output was often cut off by max_tokens — increase ANTHROPIC_MAX_TOKENS and retry.`
      );
    }
    throw e;
  }
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
      let outputBudget = MAX_TOKENS;
      for (let sub = 0; sub < 3; sub++) {
        const started = Date.now();
        logger.info("Claude API request starting", {
          model,
          attempt,
          sub,
          timeoutMs: httpTimeoutMs,
          max_tokens: outputBudget,
        });
        const response = await client.messages.create({
          model,
          max_tokens: outputBudget,
          system,
          messages: [{ role: "user", content: user }],
        });
        logger.info("Claude API response received", {
          model,
          attempt,
          sub,
          elapsedMs: Date.now() - started,
          stop_reason: response.stop_reason,
          max_tokens: outputBudget,
        });

        const usage = response.usage;
        logger.info("Claude token usage", {
          model,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          attempt,
          sub,
        });

        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text content in Claude response");
        }

        if (response.stop_reason === "max_tokens") {
          if (sub < 2 && outputBudget < 128_000) {
            outputBudget = Math.min(128_000, Math.max(32_000, outputBudget * 2));
            logger.warn("Claude hit max_tokens; retrying with higher max_tokens", { outputBudget, attempt, sub });
            await sleep(800);
            continue;
          }
          throw new Error(
            `Claude stopped at the output token limit (stop_reason: max_tokens, max_tokens=${outputBudget}). The calendar JSON is incomplete. Set ANTHROPIC_MAX_TOKENS higher or reduce row/caption size and retry.`
          );
        }

        try {
          const parsed = parseJsonArrayFromClaudeText(textBlock.text);
          if (!Array.isArray(parsed)) {
            throw new Error("Claude response is not a JSON array");
          }
          return parsed as CalendarPost[];
        } catch (parseErr) {
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          const syntax = parseErr instanceof SyntaxError;
          /** Mid-JSON cutoffs often surface as these; a second full call at max budget can still succeed. */
          const likelyTruncatedJson =
            /Unterminated string|Unexpected end of JSON input|Expected double-quoted property name|Unexpected token/i.test(
              msg
            );
          const canRaiseBudget = syntax && outputBudget < 128_000;
          const canRetryParse =
            syntax &&
            sub < 2 &&
            (canRaiseBudget || (likelyTruncatedJson && outputBudget >= 32_000));
          if (canRetryParse) {
            if (outputBudget < 128_000) {
              outputBudget = Math.min(128_000, Math.max(32_000, outputBudget * 2));
            }
            logger.warn("Claude JSON parse failed; retrying calendar request", {
              outputBudget,
              attempt,
              sub,
              likelyTruncatedJson,
              message: msg,
            });
            await sleep(800);
            continue;
          }
          logger.error("Claude JSON parse failed — raw excerpt", {
            excerpt: textBlock.text.slice(0, 4000),
            parseErr,
          });
          throw parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        }
      }
      throw new Error("Claude calendar generation exhausted internal retries");
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

/** Single Claude call returning parsed JSON (object or array). */
export async function requestClaudeJson(system: string, user: string, maxTokens: number): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey, timeout: anthropicHttpTimeoutMs(), maxRetries: 0 });
  const response = await client.messages.create({
    model: claudeModel(),
    max_tokens: Math.min(Math.max(maxTokens, 256), 16_000),
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  return parseJsonArrayFromClaudeText(textBlock.text);
}
