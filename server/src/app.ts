import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import generateRoutes from "./routes/generate";
import jobRoutes from "./routes/jobs";
import exportRoutes from "./routes/export";
import imageRoutes from "./routes/images";
import { mountBullBoardIfConfigured } from "./bullBoard";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(apiLimiter);

  const healthResponse = (_req: express.Request, res: express.Response) => {
    res.json({ success: true, data: { ok: true } });
  };
  app.get("/health", healthResponse);
  app.get("/api/health", healthResponse);

  app.use("/api/auth", authRoutes);
  app.use("/api/clients", clientRoutes);
  app.use("/api/generate", generateRoutes);
  app.use("/api/jobs", jobRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/images", imageRoutes);

  mountBullBoardIfConfigured(app);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
