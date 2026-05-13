export function openJobStream(
  userId: string,
  token: string,
  onMessage: (data: unknown) => void
): EventSource {
  const publicApi =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim()
      ? process.env.NEXT_PUBLIC_API_URL!.trim().replace(/\/$/, "")
      : "";
  const origin =
    typeof window !== "undefined"
      ? publicApi.length > 0
        ? publicApi
        : window.location.origin
      : "";
  if (!origin) {
    throw new Error("openJobStream must run in the browser");
  }
  const url = new URL("/api/jobs/stream", origin);
  url.searchParams.set("userId", userId);
  url.searchParams.set("token", token);
  const es = new EventSource(url.toString());
  es.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as unknown;
      onMessage(parsed);
    } catch {
      onMessage(null);
    }
  };
  return es;
}
