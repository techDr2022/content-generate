import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcrypt", "bullmq", "ioredis", "exceljs"],
};

export default nextConfig;
