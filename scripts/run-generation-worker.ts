/**
 * Run calendar generation worker (BullMQ) in a separate Node process.
 * Usage: `npm run worker` (with REDIS_URL and DATABASE_URL in `.env.local`).
 */
import { startGenerationWorker } from "../lib/server/workers/generationWorker";

startGenerationWorker();
