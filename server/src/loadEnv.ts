import fs from "fs";
import path from "path";
import { config } from "dotenv";

/**
 * Loads `.env` from typical monorepo layouts.
 * Do not use `cwd/..` — when cwd is the repo root that resolves to the parent folder and can load the wrong file.
 * Later files override earlier keys (same key).
 */
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "server", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(__dirname, "..", ".env"),
];

const seen = new Set<string>();
for (const file of candidates) {
  const resolved = path.resolve(file);
  if (seen.has(resolved)) continue;
  seen.add(resolved);
  if (fs.existsSync(resolved)) {
    config({ path: resolved, override: true });
  }
}
