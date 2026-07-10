import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { ENQUEUE_TIMEOUT_MS, postEnqueueWithRetry } from "@/lib/enqueueRetry";
import type { CalendarPost, GenerationJobDTO } from "@/lib/types";

export interface GeneratePayload {
  clientId: string;
  month: number;
  year: number;
  postCountOverride?: number;
  carouselCountOverride?: number;
  animatedCountOverride?: number;
  extraSpecialDays?: { label: string; date: string; type: "festival" | "awareness" | "campaign" }[];
}

export function useEnqueueGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GeneratePayload) => {
      const res = await postEnqueueWithRetry(() =>
        api.post<ApiResponse<GenerationJobDTO>>("/api/generate", payload, { timeout: ENQUEUE_TIMEOUT_MS })
      );
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Failed to enqueue");
      }
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<GenerationJobDTO>>(`/api/jobs/${jobId}`);
      return res.data.data;
    },
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "pending" || status === "processing" ? 4000 : false;
    },
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await api.post<ApiResponse<{ id: string; status: string }>>(`/api/jobs/${jobId}/cancel`);
      if (!res.data.success) {
        throw new Error(res.data.error ?? "Cancel failed");
      }
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export type RunSpecialDayRow = NonNullable<GeneratePayload["extraSpecialDays"]>[number];

export function useSuggestSpecialDays() {
  return useMutation({
    mutationFn: async (payload: { clientId: string; month: number; year: number }) => {
      const res = await api.post<ApiResponse<NonNullable<GeneratePayload["extraSpecialDays"]>>>(
        "/api/generate/suggest-special-days",
        payload,
        { timeout: 120_000 }
      );
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Could not suggest special days");
      }
      return res.data.data;
    },
  });
}

export function useJobPreview(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["job-preview", jobId],
    enabled: Boolean(jobId) && enabled,
    queryFn: async () => {
      const res = await api.get<ApiResponse<unknown[]>>(`/api/jobs/${jobId}/preview`);
      return res.data.data ?? [];
    },
  });
}

/** Typed calendar rows from a completed job workbook (same cache key as `useJobPreview`). */
export function useJobCalendarRows(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-preview", jobId],
    enabled: Boolean(jobId),
    queryFn: async () => {
      try {
        const res = await api.get<ApiResponse<CalendarPost[]>>(`/api/jobs/${jobId}/preview`);
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.error ?? "Could not load calendar preview");
        }
        return res.data.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { error?: string } | undefined;
          if (data?.error) throw new Error(data.error);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  });
}

export type RegenerateCalendarField = "textInImage" | "supportingText";

export interface RegenerateCalendarFieldPayload {
  clientId: string;
  field: RegenerateCalendarField;
  post: CalendarPost;
  rowIndex: number;
}

export function useRegenerateCalendarField() {
  return useMutation({
    mutationFn: async (payload: RegenerateCalendarFieldPayload) => {
      try {
        const res = await api.post<ApiResponse<{ value: string }>>(
          "/api/calendar/regenerate-field",
          payload,
          { timeout: 120_000 }
        );
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.error ?? "Could not regenerate copy");
        }
        return res.data.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { error?: string } | undefined;
          if (data?.error) throw new Error(data.error);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  });
}

export interface GeneratePosterImagePayload {
  textInImage: string;
  posterLook: import("@/lib/types").PosterLookId;
  posterLookCustom?: string;
  styleVariation?: import("@/lib/types").PosterStyleVariationId;
  styleVariationIndex?: number;
  improveCopy?: boolean;
  imageSize?: import("@/lib/types").PosterImageSizeId;
  imageQuality?: import("@/lib/types").PosterImageQualityId;
  outputFormat?: import("@/lib/types").PosterImageFormatId;
  outputCompression?: number;
  background?: import("@/lib/types").PosterImageBackgroundId;
  contactDetails?: string;
  logoBase64?: string;
  logoMimeType?: string;
  doctorPhotoBase64?: string;
  doctorPhotoMimeType?: string;
  brandKit?: import("@/lib/types").ClientBrandKit | null;
  contentStyle?: string;
  featuredDoctor?: string;
  clinicName?: string;
  city?: string;
  generationNotes?: string;
}

export interface PosterImageResponse {
  imageBase64: string;
  mimeType: string;
  revisedPrompt?: string;
  costUsd?: number;
}

export function useGeneratePosterImage() {
  return useMutation({
    mutationFn: async (payload: GeneratePosterImagePayload) => {
      try {
        const res = await api.post<ApiResponse<PosterImageResponse>>(
          "/api/images/generate",
          payload,
          { timeout: 180_000 }
        );
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.error ?? "Image generation failed");
        }
        return res.data.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { error?: string } | undefined;
          if (data?.error) throw new Error(data.error);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  });
}

export interface RefinePosterImagePayload {
  imageBase64: string;
  imageMimeType: string;
  editInstruction: string;
  brandKit?: import("@/lib/types").ClientBrandKit | null;
  imageSize?: import("@/lib/types").PosterImageSizeId;
  imageQuality?: import("@/lib/types").PosterImageQualityId;
  outputFormat?: import("@/lib/types").PosterImageFormatId;
  outputCompression?: number;
  background?: import("@/lib/types").PosterImageBackgroundId;
}

export function useRefinePosterImage() {
  return useMutation({
    mutationFn: async (payload: RefinePosterImagePayload) => {
      try {
        const res = await api.post<ApiResponse<PosterImageResponse>>(
          "/api/images/refine",
          payload,
          { timeout: 180_000 }
        );
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.error ?? "Image refine failed");
        }
        return res.data.data;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { error?: string } | undefined;
          if (data?.error) throw new Error(data.error);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
  });
}

