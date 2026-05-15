import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { loadWorkbookBufferForJob } from "@/lib/server/services/storageService";
import { parseCalendarPostsFromWorkbookBuffer } from "@/lib/server/handlers/jobs";
import { splitCaptionAndHashtags } from "@/lib/server/services/reviewCaptionSplit";

/**
 * Ensures a Calendar row (id = job id) and Post rows exist from the completed workbook.
 * Idempotent: replaces posts from the workbook on each call.
 */
export async function syncCalendarPostsFromJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });
  if (!job || job.status !== "done" || !job.fileUrl) {
    throw new HttpError(400, "Calendar is not available until generation completes.");
  }

  const buffer = await loadWorkbookBufferForJob({ id: job.id, fileUrl: job.fileUrl });
  const rows = await parseCalendarPostsFromWorkbookBuffer(buffer);

  await prisma.$transaction(async (tx) => {
    await tx.calendar.upsert({
      where: { id: jobId },
      create: {
        id: jobId,
        clientId: job.clientId,
        month: job.month,
        year: job.year,
      },
      update: {
        month: job.month,
        year: job.year,
        clientId: job.clientId,
      },
    });

    await tx.post.deleteMany({ where: { calendarId: jobId } });

    if (rows.length > 0) {
      await tx.post.createMany({
        data: rows.map((r, rowIndex) => {
          const { caption, hashtags } = splitCaptionAndHashtags(r.supportingText);
          return {
            calendarId: jobId,
            rowIndex,
            date: r.date,
            code: r.code,
            department: r.department,
            postType: r.type,
            style: r.style,
            textInImage: r.textInImage,
            caption,
            hashtags,
            specialDay: r.specialDayLabel,
            topic: r.topic,
            isAIAdded: r.isAIAdded,
          };
        }),
      });
    }
  });
}
