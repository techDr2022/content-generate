
async function reviewFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || json.success === false) {
    throw new Error(json.error ?? res.statusText);
  }
  return json.data as T;
}

export type ReviewVerifyOk = {
  valid: true;
  clientName: string;
  calendarMonth: string;
  calendarYear: number;
};

export async function verifyReviewSession(sessionId: string, token: string | null, pin: string | null): Promise<ReviewVerifyOk> {
  const q = new URLSearchParams();
  if (token) q.set("token", token);
  if (pin) q.set("pin", pin);
  const res = await fetch(`/api/review/sessions/${sessionId}/verify?${q.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const json = (await res.json()) as ReviewVerifyOk & { valid?: boolean; error?: string };
  if (!res.ok || json.valid !== true) {
    throw new Error(json.error ?? "Verification failed");
  }
  return json;
}

export type ReviewContentData = {
  calendar: { month: string; year: number; clientName: string; specialty: string[] };
  posts: Array<{
    id: string;
    date: string;
    type: string;
    postType: string;
    caption: string;
    hashtags: string;
    specialDay: string | null;
    posterUrl: string | null;
    feedback: {
      id: string;
      status: string;
      editedCaption: string | null;
      editedHashtags: string | null;
      rejectionReason: string | null;
      clientNote: string | null;
    } | null;
  }>;
  sessionStatus: string;
  stats: { total: number; approved: number; approvedWithEdits: number; rejected: number; pending: number };
};

export async function fetchReviewContent(sessionId: string): Promise<ReviewContentData> {
  return reviewFetch<ReviewContentData>(`/api/review/sessions/${sessionId}/content`, { method: "GET" });
}

export async function updatePostFeedback(
  sessionId: string,
  postId: string,
  body: Record<string, unknown>
): Promise<unknown> {
  return reviewFetch(`/api/review/sessions/${sessionId}/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function submitReviewSession(sessionId: string): Promise<{
  submitted: boolean;
  summary: { approved: number; approvedWithEdits: number; rejected: number };
}> {
  return reviewFetch(`/api/review/sessions/${sessionId}/submit`, { method: "POST", body: "{}" });
}
