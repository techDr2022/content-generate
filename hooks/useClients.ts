import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { ClientDTO } from "@/lib/types";

export interface ClientFilters {
  q?: string;
  specialty?: string;
}

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.specialty) params.set("specialty", filters.specialty);
      const res = await api.get<ApiResponse<ClientDTO[]>>(`/api/clients?${params.toString()}`);
      return res.data.data ?? [];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<ApiResponse<ClientDTO>>(`/api/clients/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await api.post<ApiResponse<ClientDTO>>("/api/clients", payload);
      if (!res.data.success) throw new Error(res.data.error ?? "Create failed");
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) => {
      const res = await api.put<ApiResponse<ClientDTO>>(`/api/clients/${id}`, payload);
      if (!res.data.success) throw new Error(res.data.error ?? "Update failed");
      return res.data.data;
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
      await qc.invalidateQueries({ queryKey: ["client", vars.id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ApiResponse<{ id: string }>>(`/api/clients/${id}`);
      if (!res.data.success) throw new Error(res.data.error ?? "Delete failed");
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export interface SuggestServicesPayload {
  specialties: string[];
  clinicName?: string;
  city?: string;
  doctorName?: string;
  notes?: string;
}

export function useSuggestServices() {
  return useMutation({
    mutationFn: async (payload: SuggestServicesPayload) => {
      try {
        const res = await api.post<ApiResponse<{ services: string[] }>>("/api/clients/suggest-services", payload, {
          timeout: 120_000,
        });
        if (!res.data.success || !res.data.data?.services) {
          throw new Error(res.data.error ?? "Suggestion failed");
        }
        return res.data.data.services;
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

export interface SuggestClientSpecialDaysPayload {
  specialties: string[];
  month: number;
  year: number;
  clinicName?: string;
  city?: string;
}

export type ClientSpecialDaySuggestion = {
  label: string;
  date: string;
  type: "festival" | "awareness" | "campaign";
};

export function useSuggestClientSpecialDays() {
  return useMutation({
    mutationFn: async (payload: SuggestClientSpecialDaysPayload) => {
      try {
        const res = await api.post<ApiResponse<{ days: ClientSpecialDaySuggestion[] }>>(
          "/api/clients/suggest-special-days",
          payload,
          { timeout: 120_000 }
        );
        if (!res.data.success || !res.data.data?.days) {
          throw new Error(res.data.error ?? "Could not suggest special days");
        }
        return res.data.data.days;
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
