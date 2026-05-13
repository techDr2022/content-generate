import axios from "axios";

const baseURL = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim()) || "";

export const api = axios.create({
  baseURL: baseURL || undefined,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function apiOriginConfigured(): boolean {
  return Boolean(typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim());
}

/** Prefer server `error` JSON; avoid raw axios "status code 401" strings. */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const raw = err.response?.data;
    const data =
      typeof raw === "object" && raw !== null ? (raw as { error?: string }) : undefined;
    if (data?.error) return data.error;
    const status = err.response?.status;
    if (!apiOriginConfigured() && status === 404) {
      return "The UI could not reach the API. If you use a split deployment, set NEXT_PUBLIC_API_URL to your API origin (https://…, no trailing slash), redeploy, and try again.";
    }
    if (status === 401) {
      return "Invalid credentials or your session expired. Sign in again.";
    }
    if (status === 403) {
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
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/change-password");
    if (skipLogout) {
      return Promise.reject(err);
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
