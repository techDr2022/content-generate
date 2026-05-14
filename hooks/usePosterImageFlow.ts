import { useCallback, useState } from "react";
import { posterBrandPayloadFromState, type CalendarPost, type PosterBrandAssetsState, type PosterImageOutputState, type PosterLookId } from "@/lib/types";
import { useGeneratePosterImage } from "@/hooks/useGenerator";

export function posterRowKey(post: CalendarPost, index: number): string {
  return `${post.date}-${index}`;
}

export interface PosterImageFlowOptions {
  posterLook: PosterLookId;
  posterLookCustom: string;
  imageOutput: PosterImageOutputState;
  brandAssets: PosterBrandAssetsState;
}

export function usePosterImageFlow(opts: PosterImageFlowOptions) {
  const { posterLook, posterLookCustom, imageOutput, brandAssets } = opts;
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
      const key = posterRowKey(post, rowIndex);
      setLoadingKey(key);
      setDialogError(null);
      setPreviewSrc(null);
      setPreviewMeta(null);
      setPreviewOpen(true);
      try {
        const data = await generateImage.mutateAsync({
          textInImage: text,
          posterLook,
          posterLookCustom: posterLook === "custom" ? posterLookCustom.trim() : undefined,
          ...imageOutput,
          ...posterBrandPayloadFromState(brandAssets),
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
    [brandAssets, generateImage, imageOutput, posterLook, posterLookCustom]
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
