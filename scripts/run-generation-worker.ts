/**
 * Run calendar generation worker (BullMQ) in a separate Node process.
 * Usage: `npm run worker` from the project root (same cwd as `npm run dev`) so LOCAL
 * workbooks land in the same folder Next.js reads for preview/download.
 */
import { config } from "dotenv";
import { resolve } from "path";

const root = process.cwd();
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

async function main(): Promise<void> {
  const { startGenerationWorker } = await import("../lib/server/workers/generationWorker");
  startGenerationWorker();
}

void main();
