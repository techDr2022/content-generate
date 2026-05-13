import type { VercelRequest, VercelResponse } from "@vercel/node";
import "../../server/src/loadEnv";
import { prisma } from "../../server/src/lib/prisma";
import {
  executeGenerationJob,
  finalizeGenerationFailure,
  generationJobRowToPayload,
} from "../../server/src/services/generationRunner";

/** Allow long Claude + Excel runs on Pro / Fluid (override in vercel.json if needed). */
export const config = {
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  const row = await prisma.generationJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!row) {
    res.status(200).json({ success: true, processed: false });
    return;
  }

  const claimed = await prisma.generationJob.updateMany({
    where: { id: row.id, status: "pending" },
    data: { status: "processing" },
  });

  if (claimed.count === 0) {
    res.status(200).json({ success: true, processed: false, reason: "already_claimed" });
    return;
  }

  const data = generationJobRowToPayload(row);

  const noopProgress = {
    updateProgress: async () => {
      /* Cron path — no BullMQ job record */
    },
  };

  try {
    await executeGenerationJob(data, noopProgress, { skipPendingClaim: true });
    res.status(200).json({ success: true, processed: true, jobId: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("expected processing for cron runner")) {
      res.status(200).json({ success: true, processed: false, reason: "state_race" });
      return;
    }
    await finalizeGenerationFailure(data, err);
    res.status(200).json({ success: true, processed: true, jobId: row.id, failed: true });
  }
}
