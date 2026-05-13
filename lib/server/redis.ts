import IORedis from "ioredis";

/**
 * BullMQ requires dedicated Redis connections with maxRetriesPerRequest: null.
 * Do not share one ioredis instance across unrelated commands — create a new
 * connection per Queue / Worker via getRedisConnection().
 */
export function normalizeRedisUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".upstash.io") && parsed.protocol === "redis:") {
      parsed.protocol = "rediss:";
      return parsed.toString();
    }
  } catch {
    // ignore parse errors; pass through to ioredis
  }
  return url;
}

function isUpstashHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".upstash.io");
  } catch {
    return false;
  }
}

/**
 * New IORedis connection for BullMQ Queue or Worker (not shared with app caching).
 * @see https://docs.bullmq.io/guide/connections
 */
export function getRedisConnection(): IORedis {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) {
    throw new Error("REDIS_URL is not configured");
  }
  const url = normalizeRedisUrl(raw);
  const upstash = isUpstashHost(url);
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: !upstash,
    connectTimeout: 20_000,
    retryStrategy(times) {
      return Math.min(times * 300, 10_000);
    },
  });
}
