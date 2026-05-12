export function openJobStream(
  userId: string,
  token: string,
  onMessage: (data: unknown) => void
): EventSource {
  const origin =
    typeof import.meta.env.VITE_API_URL === "string" && import.meta.env.VITE_API_URL.length > 0
      ? import.meta.env.VITE_API_URL
      : window.location.origin;
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
