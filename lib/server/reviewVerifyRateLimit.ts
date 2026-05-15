import IORedis from "ioredis";
import { normalizeRedisUrl } from "@/lib/server/redis";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

let client: IORedis | null = null;

function getLimiterRedis(): IORedis | null {
  const raw = process.env.REDIS_URL?.trim();
  if (!raw) return null;
  if (!client) {
    const url = normalizeRedisUrl(raw);
    client = new IORedis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return client;
}

/**
 * Sliding window: count entries in last WINDOW_MS for this session.
 * Returns { allowed, remaining }.
 */
export async function checkReviewVerifyRateLimit(sessionId: string): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getLimiterRedis();
  if (!redis) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
  const key = `review:verify:${sessionId}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    await redis.connect().catch(() => undefined);
    await redis.zremrangebyscore(key, 0, windowStart);
    const before = await redis.zcard(key);
    if (before >= MAX_ATTEMPTS) {
      return { allowed: false, remaining: 0 };
    }
    await redis.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    await redis.pexpire(key, WINDOW_MS);
    const after = await redis.zcard(key);
    return { allowed: true, remaining: Math.max(0, MAX_ATTEMPTS - after) };
  } catch {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
}
