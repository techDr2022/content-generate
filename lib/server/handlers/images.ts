import { z } from "zod";
import type {
  PosterImageBackgroundId,
  PosterImageFormatId,
  PosterImageQualityId,
  PosterImageSizeId,
  PosterLookId,
} from "@/lib/types";
import {
  POSTER_BRAND_IMAGE_MAX_CHARS,
  POSTER_CONTACT_DETAILS_MAX_CHARS,
  POSTER_IMAGE_BACKGROUND_IDS,
  POSTER_IMAGE_FORMAT_IDS,
  POSTER_IMAGE_QUALITY_IDS,
  POSTER_IMAGE_SIZE_IDS,
  POSTER_LOOK_IDS,
} from "@/lib/types";
import { HttpError } from "@/lib/server/http";
import { assertPosterBrandAssetsValid } from "@/lib/server/posterBrandAssetsValidate";
import {
  generatePosterImageFromText,
  refinePosterImage,
} from "@/lib/server/services/openaiImageService";
import { recordOpenAiImageUsage } from "@/lib/server/services/openaiCredits";
import { clientBrandKitSchema } from "@/lib/types/brandKit";

const posterLookSchema = z.enum(POSTER_LOOK_IDS as unknown as [PosterLookId, ...PosterLookId[]]);
const posterImageSizeSchema = z.enum(
  POSTER_IMAGE_SIZE_IDS as unknown as [PosterImageSizeId, ...PosterImageSizeId[]]
);
const posterImageQualitySchema = z.enum(
  POSTER_IMAGE_QUALITY_IDS as unknown as [PosterImageQualityId, ...PosterImageQualityId[]]
);
const posterImageFormatSchema = z.enum(
  POSTER_IMAGE_FORMAT_IDS as unknown as [PosterImageFormatId, ...PosterImageFormatId[]]
);
const posterImageBackgroundSchema = z.enum(
  POSTER_IMAGE_BACKGROUND_IDS as unknown as [PosterImageBackgroundId, ...PosterImageBackgroundId[]]
);

const generateBodySchema = z
  .object({
    textInImage: z.string().min(1, "textInImage is required").max(12000),
    posterLook: posterLookSchema,
    posterLookCustom: z.string().max(500).optional(),
    imageSize: posterImageSizeSchema.optional(),
    imageQuality: posterImageQualitySchema.optional(),
    outputFormat: posterImageFormatSchema.optional(),
    outputCompression: z.number().int().min(0).max(100).optional(),
    background: posterImageBackgroundSchema.optional(),
    contactDetails: z.string().max(POSTER_CONTACT_DETAILS_MAX_CHARS).optional(),
    logoBase64: z.string().max(POSTER_BRAND_IMAGE_MAX_CHARS).optional(),
    logoMimeType: z.string().max(80).optional(),
    doctorPhotoBase64: z.string().max(POSTER_BRAND_IMAGE_MAX_CHARS).optional(),
    doctorPhotoMimeType: z.string().max(80).optional(),
    brandKit: clientBrandKitSchema.nullable().optional(),
    contentStyle: z.string().max(120).optional(),
    featuredDoctor: z.string().max(200).optional(),
    clinicName: z.string().max(200).optional(),
    city: z.string().max(120).optional(),
    generationNotes: z.string().max(8000).optional(),
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

export async function generateImageFromCalendarText(body: unknown, userId?: string) {
  const parsed = generateBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first?.message ?? "Invalid request body");
  }

  let brandFields: ReturnType<typeof assertPosterBrandAssetsValid>;
  try {
    brandFields = assertPosterBrandAssetsValid({
      logoBase64: parsed.data.logoBase64,
      logoMimeType: parsed.data.logoMimeType,
      doctorPhotoBase64: parsed.data.doctorPhotoBase64,
      doctorPhotoMimeType: parsed.data.doctorPhotoMimeType,
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, e instanceof Error ? e.message : "Invalid brand assets");
  }

  const contactTrimmed = parsed.data.contactDetails?.trim();

  try {
    const out = await generatePosterImageFromText({
      textInImage: parsed.data.textInImage,
      posterLook: parsed.data.posterLook,
      posterLookCustom: parsed.data.posterLookCustom,
      imageSize: parsed.data.imageSize,
      imageQuality: parsed.data.imageQuality,
      outputFormat: parsed.data.outputFormat,
      outputCompression: parsed.data.outputCompression,
      background: parsed.data.background,
      ...(contactTrimmed ? { contactDetails: contactTrimmed } : {}),
      ...(parsed.data.brandKit ? { brandKit: parsed.data.brandKit } : {}),
      ...(parsed.data.contentStyle?.trim()
        ? { contentStyle: parsed.data.contentStyle.trim() }
        : {}),
      ...(parsed.data.featuredDoctor?.trim()
        ? { featuredDoctor: parsed.data.featuredDoctor.trim() }
        : {}),
      ...(parsed.data.clinicName?.trim() ? { clinicName: parsed.data.clinicName.trim() } : {}),
      ...(parsed.data.city?.trim() ? { city: parsed.data.city.trim() } : {}),
      ...(parsed.data.generationNotes?.trim()
        ? { generationNotes: parsed.data.generationNotes.trim() }
        : {}),
      ...brandFields,
    });
    await recordOpenAiImageUsage({
      userId,
      operation: out.usage.operation,
      model: out.usage.model,
      size: out.usage.size,
      quality: out.usage.quality,
      costUsd: out.usage.costUsd,
    });
    return {
      success: true as const,
      data: {
        imageBase64: out.b64,
        mimeType: out.mimeType,
        revisedPrompt: out.revisedPrompt,
        costUsd: out.usage.costUsd,
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

const refineBodySchema = z.object({
  imageBase64: z.string().min(100).max(POSTER_BRAND_IMAGE_MAX_CHARS),
  imageMimeType: z.string().max(80),
  editInstruction: z.string().min(3).max(2000),
  brandKit: clientBrandKitSchema.nullable().optional(),
  imageSize: posterImageSizeSchema.optional(),
  imageQuality: posterImageQualitySchema.optional(),
  outputFormat: posterImageFormatSchema.optional(),
  outputCompression: z.number().int().min(0).max(100).optional(),
  background: posterImageBackgroundSchema.optional(),
});

export async function refineImageFromPoster(body: unknown, userId?: string) {
  const parsed = refineBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first?.message ?? "Invalid request body");
  }

  try {
    const out = await refinePosterImage({
      imageBase64: parsed.data.imageBase64,
      imageMimeType: parsed.data.imageMimeType,
      editInstruction: parsed.data.editInstruction,
      imageSize: parsed.data.imageSize,
      imageQuality: parsed.data.imageQuality,
      outputFormat: parsed.data.outputFormat,
      outputCompression: parsed.data.outputCompression,
      background: parsed.data.background,
      ...(parsed.data.brandKit ? { brandKit: parsed.data.brandKit } : {}),
    });
    await recordOpenAiImageUsage({
      userId,
      operation: out.usage.operation,
      model: out.usage.model,
      size: out.usage.size,
      quality: out.usage.quality,
      costUsd: out.usage.costUsd,
    });
    return {
      success: true as const,
      data: {
        imageBase64: out.b64,
        mimeType: out.mimeType,
        revisedPrompt: out.revisedPrompt,
        costUsd: out.usage.costUsd,
      },
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("OPENAI_API_KEY")) {
      throw new HttpError(503, msg);
    }
    throw new HttpError(502, `Image refine failed: ${msg}`);
  }
}
