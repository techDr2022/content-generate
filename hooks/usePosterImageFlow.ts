import { useCallback, useState } from "react";
import { posterBrandPayloadFromState, type CalendarPost, type PosterBrandAssetsState, type PosterImageOutputState, type PosterLookId } from "@/lib/types";
import type { RowPosterLook } from "@/lib/posterRowLooks";
import { isRowPosterLookBlocked } from "@/lib/posterRowLooks";
import { useGeneratePosterImage } from "@/hooks/useGenerator";

export function posterRowKey(post: CalendarPost, index: number): string {
  return `${post.date}-${index}`;
}

export interface PosterImageFlowOptions {
  /** Fallback when getRowLook is not provided or returns undefined. */
  posterLook: PosterLookId;
  posterLookCustom: string;
  getRowLook?: (rowIndex: number) => RowPosterLook | undefined;
  imageOutput: PosterImageOutputState;
  brandAssets: PosterBrandAssetsState;
  clientId?: string;
  brandKit?: import("@/lib/types").ClientBrandKit | null;
  clinicName?: string;
  city?: string;
  generationNotes?: string | null;
  featuredDoctorForRow?: (rowIndex: number) => string | undefined;
}

function resolveRowLook(
  rowIndex: number,
  fallback: { posterLook: PosterLookId; posterLookCustom: string },
  getRowLook?: (rowIndex: number) => RowPosterLook | undefined
): RowPosterLook {
  return getRowLook?.(rowIndex) ?? { posterLook: fallback.posterLook, posterLookCustom: fallback.posterLookCustom };
}

export function usePosterImageFlow(opts: PosterImageFlowOptions) {
  const {
    posterLook,
    posterLookCustom,
    getRowLook,
    imageOutput,
    brandAssets,
    clientId,
    brandKit,
    clinicName,
    city,
    generationNotes,
    featuredDoctorForRow,
  } = opts;
  const generateImage = useGeneratePosterImage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ date: string; revisedPrompt?: string } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const resetDialogContent = useCallback(() => {
    setPreviewSrc(null);
    setPreviewMeta(null);
    setDialogError(null);
  }, []);

  const generateFromPost = useCallback(
    async (post: CalendarPost, rowIndex: number) => {
      const text = post.textInImage?.trim();
      if (!text) return;
      const look = resolveRowLook(rowIndex, { posterLook, posterLookCustom }, getRowLook);
      if (isRowPosterLookBlocked(look)) return;

      const key = posterRowKey(post, rowIndex);
      setLoadingKey(key);
      setDialogError(null);
      setPreviewSrc(null);
      setPreviewMeta(null);
      setPreviewOpen(true);
      try {
        const data = await generateImage.mutateAsync({
          textInImage: text,
          posterLook: look.posterLook,
          posterLookCustom: look.posterLook === "custom" ? look.posterLookCustom.trim() : undefined,
          contentStyle: post.style,
          ...imageOutput,
          ...posterBrandPayloadFromState(brandAssets),
          ...(brandKit ? { brandKit } : {}),
          ...(clinicName ? { clinicName } : {}),
          ...(featuredDoctorForRow?.(rowIndex)
            ? { featuredDoctor: featuredDoctorForRow(rowIndex) }
            : {}),
          ...(city ? { city } : {}),
          ...(generationNotes?.trim() ? { generationNotes: generationNotes.trim() } : {}),
        });
        const src = `data:${data.mimeType};base64,${data.imageBase64}`;
        setPreviewSrc(src);
        setPreviewMeta({ date: post.date, revisedPrompt: data.revisedPrompt });
      } catch (e) {
        setDialogError(e instanceof Error ? e.message : "Could not generate image");
      } finally {
        setLoadingKey(null);
      }
    },
    [
      brandAssets,
      brandKit,
      city,
      clinicName,
      generateImage,
      generationNotes,
      getRowLook,
      imageOutput,
      posterLook,
      posterLookCustom,
    ]
  );

  const showLoading = generateImage.isPending && !previewSrc && !dialogError;

  return {
    generateFromPost,
    loadingKey,
    isPending: generateImage.isPending,
    previewOpen,
    setPreviewOpen,
    previewSrc,
    previewMeta,
    dialogError,
    showLoading,
    onDialogOpenChange: (open: boolean) => {
      setPreviewOpen(open);
      if (!open) resetDialogContent();
    },
  };
}
