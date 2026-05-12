import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: baseURL || undefined,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Prefer server `error` JSON; avoid raw axios "status code 401" strings. */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.response?.status === 401) {
      return "Invalid credentials or your session expired. Sign in again.";
    }
    if (err.response?.status === 403) {
      return data?.error ?? "You don’t have permission for this action.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!axios.isAxiosError(err) || err.response?.status !== 401) {
      return Promise.reject(err);
    }
    const url = err.config?.url ?? "";
    const skipLogout =
      url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/change-password");
    if (skipLogout) {
      return Promise.reject(err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
