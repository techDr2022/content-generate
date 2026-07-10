import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "ANTHROPIC_API_KEY",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = parseEnvFile(envPath);
const missing = required.filter((key) => !env[key]?.trim());
const empty = required.filter((key) => key in env && !env[key]?.trim());

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  console.error("Copy .env.local.example → .env.local and fill in secrets from Neon / Upstash / Vercel.");
  process.exit(1);
}

if (missing.length || empty.length) {
  console.error("Local env is incomplete for Prisma/API:");
  for (const key of [...new Set([...missing, ...empty])]) {
    console.error(`  - ${key}`);
  }
  console.error("");
  console.error("Vercel production secrets are type=sensitive and cannot be read with `vercel env pull`.");
  console.error("They are stored as empty strings locally, which breaks `npm run dev`.");
  console.error("");
  console.error("Fix options:");
  console.error("  1. Paste real values into .env.local (Neon → DATABASE_URL, Upstash → REDIS_URL, etc.)");
  console.error("  2. Add Development env vars in Vercel, then run: vercel env pull .env.local");
  console.error("     https://vercel.com/techdr2022s-projects/content-generate/settings/environment-variables");
  process.exit(1);
}

console.log("Environment OK:", required.join(", "));
