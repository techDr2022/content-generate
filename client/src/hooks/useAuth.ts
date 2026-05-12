import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      try {
        const res = await api.post<ApiResponse<{ ok: boolean }>>("/api/auth/change-password", payload);
        if (!res.data.success || !res.data.data) {
          throw new Error(res.data.error ?? "Could not update password");
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
