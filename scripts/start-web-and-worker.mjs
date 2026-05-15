/**
 * Run `next start` and the BullMQ generation worker in one OS process tree.
 * Use on Railway (or any single-container Node host) so queued jobs are consumed.
 *
 * Starts Next first and waits for /api/health so platform healthchecks succeed even if
 * the worker exits early (e.g. misconfigured Redis); then starts the worker.
 */
import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

const port = process.env.PORT || "3000";

function killAll() {
  for (const c of children) {
    try {
      if (c.exitCode === null) c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

function onChildExit(which, code, signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[start-web-and-worker] ${which} exited`, { code, signal });
  killAll();
  process.exit(code ?? (signal ? 1 : 0));
}

const next = spawn("npm", ["run", "start"], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});
children.push(next);

next.on("exit", (code, signal) => onChildExit("next", code, signal));

async function waitForNextHealth(maxMs = 90_000) {
  const url = `http://127.0.0.1:${port}/api/health`;
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxMs) {
    if (shuttingDown) return;
    attempt += 1;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        console.log(`[start-web-and-worker] Next ready after ${attempt} attempt(s)`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`[start-web-and-worker] Next did not become healthy at ${url} within ${maxMs}ms`);
}

async function startWorkerAfterNextReady() {
  try {
    await waitForNextHealth();
    if (shuttingDown) return;

    const worker = spawn("npm", ["run", "worker"], {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    });
    children.push(worker);
    worker.on("exit", (code, signal) => onChildExit("worker", code, signal));
  } catch (err) {
    console.error(err);
    if (!shuttingDown) {
      shuttingDown = true;
      killAll();
      process.exit(1);
    }
  }
}

void startWorkerAfterNextReady();

function shutdownFromSignal() {
  if (shuttingDown) return;
  shuttingDown = true;
  killAll();
  process.exit(0);
}

process.on("SIGTERM", shutdownFromSignal);
process.on("SIGINT", shutdownFromSignal);
