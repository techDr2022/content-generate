import OpenAI from "openai";

let cached: { key: string; client: OpenAI } | null = null;

/** Reuse one HTTP client per API key (connection pooling, fewer handshakes). */
export function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const timeoutMs = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS) || 120_000;
  if (!cached || cached.key !== apiKey) {
    cached = {
      key: apiKey,
      client: new OpenAI({
        apiKey,
        timeout: Number.isFinite(timeoutMs) ? timeoutMs : 120_000,
        maxRetries: 1,
      }),
    };
  }
  return cached.client;
}
