import { Queue } from "bullmq";
import { getRedisConnection } from "../redis";
import { HttpError } from "../http";
import type { GenerateJobPayload } from "@/lib/types";

export const CONTENT_QUEUE_NAME = "content-generation";

let queue: Queue<GenerateJobPayload> | null = null;

export function assertRedisForQueue(): void {
  if (!process.env.REDIS_URL?.trim()) {
    throw new HttpError(
      503,
      "Redis is not configured (REDIS_URL). Add your Railway Redis URL to .env to enable calendar generation."
    );
  }
}

export function getContentQueue(): Queue<GenerateJobPayload> {
  assertRedisForQueue();
  if (!queue) {
    queue = new Queue<GenerateJobPayload>(CONTENT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return queue;
}
