import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { GenerationJobDTO } from "@/lib/types";

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<GenerationJobDTO[]>>("/api/jobs");
      return res.data.data ?? [];
    },
  });
}

export function useRegenerateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await api.post<ApiResponse<GenerationJobDTO>>(`/api/jobs/${jobId}/regenerate`, {});
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Regenerate failed");
      }
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
