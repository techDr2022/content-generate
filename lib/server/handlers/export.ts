import fs from "fs";
import JSZip from "jszip";
import { z } from "zod";
import type { GenerationJob } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { getLocalWorkbookPath } from "@/lib/server/services/storageService";

const zipSchema = z.object({
  jobIds: z.array(z.string()).min(1),
});

export async function downloadBulkZip(userId: string, body: unknown): Promise<Response> {
  const parsed = zipSchema.parse(body);

  const jobs = await prisma.generationJob.findMany({
    where: { id: { in: parsed.jobIds }, userId },
    include: { client: true },
  });

  if (jobs.length !== parsed.jobIds.length) {
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
  return new Response(Buffer.from(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=calendars.zip",
    },
  });
}
