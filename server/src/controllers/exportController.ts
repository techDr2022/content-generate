import type { Request, Response } from "express";
import fs from "fs";
import JSZip from "jszip";
import { z } from "zod";
import type { GenerationJob } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { getLocalWorkbookPath } from "../services/storageService";

const zipSchema = z.object({
  jobIds: z.array(z.string()).min(1),
});

export async function downloadBulkZip(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = zipSchema.parse(req.body);

  const jobs = await prisma.generationJob.findMany({
    where: { id: { in: body.jobIds }, userId },
    include: { client: true },
  });

  if (jobs.length !== body.jobIds.length) {
    throw new HttpError(404, "One or more jobs were not found");
  }

  const notDone = jobs.filter((j: GenerationJob) => j.status !== "done");
  if (notDone.length) {
    throw new HttpError(400, "All jobs must be completed before zipping");
  }

  const storage = process.env.STORAGE_TYPE ?? "LOCAL";
  if (storage !== "LOCAL") {
    throw new HttpError(400, "Bulk ZIP is only supported for LOCAL storage in this build");
  }

  const zip = new JSZip();
  for (const job of jobs) {
    const p = getLocalWorkbookPath(job.id);
    if (!fs.existsSync(p)) {
      throw new HttpError(404, `Missing file for job ${job.id}`);
    }
    const buf = await fs.promises.readFile(p);
    const name = `${job.client.name}-${job.year}-${String(job.month).padStart(2, "0")}.xlsx`;
    zip.file(name, buf);
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=calendars.zip");
  res.send(out);
}
