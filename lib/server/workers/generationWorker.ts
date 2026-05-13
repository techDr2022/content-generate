import { Worker } from "bullmq";
import type { GenerateJobPayload } from "@/lib/types";
import { getRedisConnection } from "../redis";
import { CONTENT_QUEUE_NAME } from "../services/jobQueue";
import { logger } from "../logger";
import {
  executeGenerationJob,
  finalizeGenerationFailure,
} from "../services/generationRunner";

export function startGenerationWorker(): Worker<GenerateJobPayload> {
  const worker = new Worker<GenerateJobPayload>(
    CONTENT_QUEUE_NAME,
    async (job) => {
      logger.info("Worker picked up job", {
        queue: CONTENT_QUEUE_NAME,
        bullJobId: job.id,
        data: job.data,
      });

      await executeGenerationJob(job.data, {
        updateProgress: (obj) => job.updateProgress(obj),
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  );

  worker.on("ready", () => {
    logger.info("BullMQ worker ready — consuming queue", { queue: CONTENT_QUEUE_NAME });
  });

  worker.on("failed", async (job, err) => {
    if (!job?.data) return;
    await finalizeGenerationFailure(job.data, err);
  });

  return worker;
}
