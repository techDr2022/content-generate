import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

/** Reuse one client across warm serverless invocations (Vercel) and local dev. */
if (process.env.NODE_ENV !== "production" || process.env.VERCEL === "1") {
  globalForPrisma.prisma = prisma;
}
