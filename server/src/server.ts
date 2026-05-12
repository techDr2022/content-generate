import "./loadEnv";
import { createApp } from "./app";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startGenerationWorker } from "./workers/generationWorker";

const port = Number(process.env.PORT ?? 4000);

const app = createApp();

if (process.env.REDIS_URL) {
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
    (err) => {
      logger.error(
        "PostgreSQL unreachable (check DATABASE_URL). Generation, clients, and jobs will fail until Neon/your DB accepts connections (P1001 = network / paused project / wrong host).",
        { err: err instanceof Error ? err.message : String(err) }
      );
    }
  );
});
