import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import { ENQUEUE_TIMEOUT_MS, postEnqueueWithRetry } from "@/lib/enqueueRetry";
import type { GenerationJobDTO } from "@hc/shared";
import type { GeneratePayload } from "./useGenerator";

export function useEnqueueBulkGenerate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobs: GeneratePayload[]) => {
      const res = await postEnqueueWithRetry(() =>
        api.post<ApiResponse<GenerationJobDTO[]>>("/api/generate/bulk", { jobs }, { timeout: ENQUEUE_TIMEOUT_MS })
      );
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.error ?? "Bulk enqueue failed");
      }
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export async function downloadBulkZip(jobIds: string[]): Promise<Blob> {
  const res = await api.post("/api/export/bulk-zip", { jobIds }, { responseType: "blob" });
  return res.data as Blob;
}
