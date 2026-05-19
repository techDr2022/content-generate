#!/usr/bin/env node
/**
 * Clear prior Next build output before `next build`.
 * Skips `.next/cache` when it is a busy mount (Railway/Docker build cache).
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const nextDir = join(process.cwd(), ".next");

if (!existsSync(nextDir)) {
  process.exit(0);
}

function removePath(target) {
  rmSync(target, { recursive: true, force: true });
}

function cleanExceptCache() {
  for (const name of readdirSync(nextDir)) {
    if (name === "cache") continue;
    removePath(join(nextDir, name));
  }
}

try {
  removePath(nextDir);
} catch (err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : undefined;
  if (code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY") {
    cleanExceptCache();
  } else {
    throw err;
  }
}
