import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` (including npm `postinstall`) must not require a real DB URL.
 * Docker/CI often run `npm ci` before secrets are available.
 */
function databaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
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
