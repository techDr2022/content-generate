"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

require("./load-root-env.cjs");

const root = path.join(__dirname, "..");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Add it to " + path.join(root, ".env") + " (see .env.local.example)."
  );
  process.exit(1);
}

const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
