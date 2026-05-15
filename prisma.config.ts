import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` (including npm `postinstall`) must not require a real DB URL.
 * Docker/CI often run `npm ci` before secrets are available.
 *
 * For `prisma migrate` against Neon: use a *direct* connection string in DIRECT_URL
 * (host without `-pooler`). Pooler URLs often hit P1002 advisory lock timeouts.
 * Runtime Prisma Client still uses DATABASE_URL from `schema.prisma` (can stay pooled).
 */
/** Neon pooler hostnames include `-pooler`; migrate needs the direct endpoint. */
function neonDirectUrl(pooledUrl: string): string | null {
  try {
    const normalized = pooledUrl.replace(/^postgres:\/\//i, "postgresql://");
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes("-pooler")) return null;
    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    return null;
  }
}

function databaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    const derived = neonDirectUrl(fromEnv);
    if (derived) return derived;
    return fromEnv;
  }
  return "postgresql://build:build@127.0.0.1:5432/build?schema=public";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});
