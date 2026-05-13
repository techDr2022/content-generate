import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcrypt", "bullmq", "ioredis", "exceljs"],
};

export default nextConfig;
