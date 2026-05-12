import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Empty `VITE_API_URL=` in .env is a string, not null — still use default backend for the dev proxy. */
const devApiTarget =
  (typeof process.env.VITE_API_URL === "string" ? process.env.VITE_API_URL.trim() : "") ||
  "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Resolve shared types from TS sources so Vite can tree-shake named exports (CJS interop from dist is brittle).
      "@hc/shared": path.resolve(__dirname, "../shared/types/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Long-lived SSE must not use the same timeout as normal API calls — 180s
      // kills EventSource mid-generation and breaks progress updates.
      "/api/jobs/stream": {
        target: devApiTarget,
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
        // Enqueue + Redis retries can exceed default proxy timeouts during dev.
        timeout: 180_000,
        proxyTimeout: 180_000,
      },
    },
  },
});
