"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchReviewContent } from "@/lib/reviewClientFetch";

export default function ReviewSubmittedPage(): JSX.Element {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { data } = useQuery({
    queryKey: ["review-content", sessionId],
    queryFn: () => fetchReviewContent(sessionId),
  });

  const router = useRouter();

  useEffect(() => {
    if (data && data.sessionStatus !== "SUBMITTED") {
      router.replace(`/review/${sessionId}/calendar`);
    }
  }, [data, router, sessionId]);

  const s = data?.stats;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Thank you</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your review has been submitted. {s ? `${s.approved} approved` : ""}
        {s ? `, ${s.approvedWithEdits} with edits` : ""}
        {s ? `, ${s.rejected} rejected` : ""}.
      </p>
      <p className="mt-4 text-sm text-slate-700">Your account manager will be in touch if anything needs follow-up.</p>
    </div>
  );
}
