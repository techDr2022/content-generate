"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

require("./load-root-env.cjs");

const root = path.join(__dirname, "..");
const serverDir = path.join(root, "server");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "Create a file at:\n  " +
      path.join(root, ".env") +
      "\n(copy from .env.example) and add your Neon connection string."
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "dev"], {
  cwd: serverDir,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
