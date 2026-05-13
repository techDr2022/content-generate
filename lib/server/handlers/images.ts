import { z } from "zod";
import type { PosterLookId } from "@/lib/types";
import { POSTER_LOOK_IDS } from "@/lib/types";
import { HttpError } from "@/lib/server/http";
import { generatePosterImageFromText } from "@/lib/server/services/openaiImageService";

const posterLookSchema = z.enum(POSTER_LOOK_IDS as unknown as [PosterLookId, ...PosterLookId[]]);

const generateBodySchema = z
  .object({
    textInImage: z.string().min(1, "textInImage is required").max(12000),
    posterLook: posterLookSchema,
    posterLookCustom: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.posterLook === "custom") {
      const t = data.posterLookCustom?.trim() ?? "";
      if (t.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add custom poster instructions when “Custom” is selected.",
          path: ["posterLookCustom"],
        });
      }
    }
  });

export async function generateImageFromCalendarText(body: unknown) {
  const parsed = generateBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first?.message ?? "Invalid request body");
  }

  try {
    const out = await generatePosterImageFromText({
      textInImage: parsed.data.textInImage,
      posterLook: parsed.data.posterLook,
      posterLookCustom: parsed.data.posterLookCustom,
    });
    return {
      success: true as const,
      data: {
        imageBase64: out.b64,
        mimeType: out.mimeType,
        revisedPrompt: out.revisedPrompt,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("OPENAI_API_KEY")) {
      throw new HttpError(503, msg);
    }
    throw new HttpError(502, `Image generation failed: ${msg}`);
  }
}
