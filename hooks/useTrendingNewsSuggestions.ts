import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type ApiResponse } from "@/lib/api";
import type { TrendingNewsCardDTO, TrendingPosterPrefillV1 } from "@/lib/types/newsSuggestions";

const PREFILL_KEY = "techdr_trending_poster_prefill";

export function useTrendingNewsSuggestions(specialty?: string, limit = 5) {
  return useQuery({
    queryKey: ["trending-news", specialty ?? "", limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (specialty) params.set("specialty", specialty);
      const res = await api.get<ApiResponse<TrendingNewsCardDTO[]>>(`/api/dashboard/news-suggestions?${params.toString()}`);
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Could not load trending news");
      }
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveNewsSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newsItemId: string) => {
      const res = await api.post<ApiResponse<{ id: string; saved: boolean }>>(
        `/api/news-suggestions/${encodeURIComponent(newsItemId)}/save`
      );
      if (!res.data.success) throw new Error(res.data.error ?? "Save failed");
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["trending-news"] });
    },
  });
}

export function useDismissNewsSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newsItemId: string) => {
      const res = await api.post<ApiResponse<{ id: string; dismissed: boolean }>>(
        `/api/news-suggestions/${encodeURIComponent(newsItemId)}/dismiss`
      );
      if (!res.data.success) throw new Error(res.data.error ?? "Dismiss failed");
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["trending-news"] });
    },
  });
}

export function usePosterPrefillFromSuggestion() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (args: { suggestionId: string; variantIndex: number }) => {
      const res = await api.post<ApiResponse<TrendingPosterPrefillV1>>(
        `/api/posters/from-suggestion/${encodeURIComponent(args.suggestionId)}`,
        { variantIndex: args.variantIndex }
      );
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Could not build poster draft");
      }
      return res.data.data;
    },
    onSuccess: (data) => {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(data));
      }
      router.push("/poster-images?prefill=1");
    },
  });
}

export { PREFILL_KEY as TRENDING_POSTER_PREFILL_KEY };
