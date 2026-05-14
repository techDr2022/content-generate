/**
 * Run calendar generation worker (BullMQ) in a separate Node process.
 * Usage: `npm run worker` from the project root (same cwd as `npm run dev`) so LOCAL
 * workbooks land in the same folder Next.js reads for preview/download.
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const root = process.cwd();

/** Match Next.js env precedence (low → high); last file wins. */
function loadEnvForWorker(): void {
  config({ path: resolve(root, ".env") });
  const serverEnv = resolve(root, "server", ".env");
  if (existsSync(serverEnv)) {
    config({ path: serverEnv, override: true });
  }
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    config({ path: resolve(root, ".env.production"), override: true });
    config({ path: resolve(root, ".env.local"), override: true });
    config({ path: resolve(root, ".env.production.local"), override: true });
  } else {
    config({ path: resolve(root, ".env.development"), override: true });
    config({ path: resolve(root, ".env.local"), override: true });
    config({ path: resolve(root, ".env.development.local"), override: true });
  }
}

loadEnvForWorker();

async function main(): Promise<void> {
  if (!process.env.REDIS_URL?.trim()) {
    console.error(
      "[worker] REDIS_URL is not set after loading env files from the repo root.\n" +
        "  • Add REDIS_URL=rediss://... (Upstash: Redis tab, not REST).\n" +
        "  • Run this script from the project root (same folder as package.json).\n" +
        "  • Next.js also reads .env.development.local — that file is loaded here when not production."
    );
    process.exit(1);
  }
  const { startGenerationWorker } = await import("../lib/server/workers/generationWorker");
  startGenerationWorker();
}

void main();
