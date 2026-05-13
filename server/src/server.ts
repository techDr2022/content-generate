import "./loadEnv";
import { createApp } from "./app";
import { useCronDatabaseJobRunner } from "./lib/jobRunnerMode";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startGenerationWorker } from "./workers/generationWorker";

const port = Number(process.env.PORT ?? 4000);

const app = createApp();

if (useCronDatabaseJobRunner()) {
  logger.info(
    "Cron/database job runner mode — BullMQ worker not started (calendar jobs run via Vercel Cron hitting /api/cron/run-worker)."
  );
} else if (process.env.REDIS_URL) {
  startGenerationWorker();
} else {
  logger.warn(
    "REDIS_URL is not set — API will start but BullMQ worker and /api/generate are disabled until Redis is configured."
  );
}

app.listen(port, () => {
  logger.info(`API listening on port ${port}`);
  void prisma.$connect().then(
    () => logger.info("PostgreSQL reachable"),
    (err: unknown) => {
      logger.error(
        "PostgreSQL unreachable (check DATABASE_URL). Generation, clients, and jobs will fail until Neon/your DB accepts connections (P1001 = network / paused project / wrong host).",
        { err: err instanceof Error ? err.message : String(err) }
      );
    }
  );
});
