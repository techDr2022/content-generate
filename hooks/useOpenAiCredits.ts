import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { DashboardPeriod } from "@/lib/dashboardPeriod";

export type OpenAiCreditsDTO = {
  creditsRemainingUsd: number | null;
  creditsGrantedUsd: number | null;
  creditsUsedUsd: number | null;
  balanceSource: "openai" | "manual" | "estimated" | "unavailable";
  autoRechargeUsd: number | null;
  trackedSpendUsd: number;
  periodSpendUsd: number;
  imagesInPeriod: number;
  lastImageCostUsd: number | null;
  lastImageAt: string | null;
  configured: boolean;
};

export function useOpenAiCredits(
  period: DashboardPeriod,
  opts: { monthKey: string; dayKey: string; from: string; to: string }
) {
  return useQuery({
    queryKey: ["openai-credits", period, opts.monthKey, opts.dayKey, opts.from, opts.to],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === "month") params.set("monthKey", opts.monthKey);
      if (period === "day") params.set("dayKey", opts.dayKey);
      if (period === "custom") {
        if (opts.from) params.set("from", opts.from);
        if (opts.to) params.set("to", opts.to);
      }
      const res = await api.get<ApiResponse<OpenAiCreditsDTO>>(
        `/api/dashboard/openai-credits?${params.toString()}`
      );
      return res.data.data ?? null;
    },
  });
}
