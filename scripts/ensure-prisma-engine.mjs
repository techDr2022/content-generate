#!/usr/bin/env node
/**
 * Runs `prisma generate`. If the native query engine was not copied (common when disk is full),
 * symlink it from @prisma/engines so the worker and API can start.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function findQueryEngineName(dir) {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir).filter((f) => f.startsWith("libquery_engine-"));
  return names[0] ?? null;
}

function linkEngineIfMissing(clientDir, enginesDir) {
  const engineName = findQueryEngineName(enginesDir);
  if (!engineName) return false;

  const clientEngine = join(clientDir, engineName);
  const bundledEngine = join(enginesDir, engineName);
  if (!existsSync(bundledEngine)) return false;
  if (existsSync(clientEngine)) return true;

  const relativeLink = `../../@prisma/engines/${engineName}`;
  try {
    symlinkSync(relativeLink, clientEngine);
    console.warn(
      `[ensure-prisma-engine] Linked ${clientEngine} → ${relativeLink} (prisma generate did not copy the binary; free disk space and run npm run db:generate)`
    );
    return true;
  } catch (e) {
    console.error("[ensure-prisma-engine] Could not link query engine:", e);
    return false;
  }
}

function runPrismaGenerate() {
  const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
  if (!existsSync(prismaCli)) {
    console.error("[ensure-prisma-engine] Prisma is not installed (expected at node_modules/prisma).");
    return false;
  }
  const result = spawnSync(process.execPath, [prismaCli, "generate"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  return result.status === 0;
}

const clientDir = join(root, "node_modules/.prisma/client");
const enginesDir = join(root, "node_modules/@prisma/engines");

const generateOk = runPrismaGenerate();

const clientEngineName = findQueryEngineName(clientDir);
if (clientEngineName) {
  process.exit(0);
}

if (linkEngineIfMissing(clientDir, enginesDir)) {
  process.exit(0);
}

const bundledName = findQueryEngineName(enginesDir);
console.error(
  `[ensure-prisma-engine] Missing query engine in ${clientDir}${
    bundledName ? ` (bundled ${bundledName} could not be linked)` : " and no bundled engine in @prisma/engines"
  }. prisma generate ${generateOk ? "ran but did not produce a binary" : "failed"}. Run: npx prisma generate`
);
process.exit(1);
