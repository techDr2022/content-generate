import type { Express } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { logger } from "./lib/logger";
import { getContentQueue } from "./services/jobQueue";

export function mountBullBoardIfConfigured(app: Express): void {
  if (!process.env.REDIS_URL?.trim()) return;
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");
    createBullBoard({
      queues: [new BullMQAdapter(getContentQueue())],
      serverAdapter,
    });
    app.use("/admin/queues", serverAdapter.getRouter());
    logger.info("Bull Board mounted at /admin/queues");
  } catch (err) {
    logger.warn("Bull Board failed to mount", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
