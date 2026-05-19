import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "bcrypt", "bullmq", "ioredis", "exceljs"],
  // Avoid writing large webpack packs to disk (reduces ENOSPC / corrupt .next on low space).
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
