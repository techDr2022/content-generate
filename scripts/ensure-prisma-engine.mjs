#!/usr/bin/env node
/**
 * Runs `prisma generate`. If the native query engine was not copied (common when disk is full),
 * symlink it from @prisma/engines so the worker and API can start on macOS arm64.
 */
import { execSync } from "node:child_process";
import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function enginePaths() {
  const clientDir = join(root, "node_modules/.prisma/client");
  const enginesDir = join(root, "node_modules/@prisma/engines");
  const name = `libquery_engine-${process.platform === "darwin" ? "darwin" : process.platform}-${process.arch}.dylib.node`;
  return {
    clientEngine: join(clientDir, name),
    bundledEngine: join(enginesDir, name),
    relativeLink: `../../@prisma/engines/${name}`,
  };
}

function linkEngineIfMissing() {
  const { clientEngine, bundledEngine, relativeLink } = enginePaths();
  if (!existsSync(bundledEngine)) return false;
  if (existsSync(clientEngine)) return true;
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

try {
  execSync("npx prisma generate", { cwd: root, stdio: "inherit", env: process.env });
} catch {
  // generate may fail when disk is full; still try to link
}

const { clientEngine, bundledEngine } = enginePaths();
if (!existsSync(clientEngine)) {
  if (!linkEngineIfMissing()) {
    console.error(
      `[ensure-prisma-engine] Missing query engine at ${clientEngine} and no bundle at ${bundledEngine}. Run: npx prisma generate`
    );
    process.exit(1);
  }
}
