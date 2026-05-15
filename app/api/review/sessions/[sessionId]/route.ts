import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/routeHelpers";
import { getReviewBaseUrl, getReviewSessionDetailInternal } from "@/lib/server/handlers/review";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { sessionId } = await ctx.params;
    const row = await getReviewSessionDetailInternal(auth.sub, sessionId);
    const reviewUrl = `${getReviewBaseUrl()}/review/${row.id}?token=${encodeURIComponent(row.accessToken)}`;
    const { accessToken: _accessToken, ...session } = row;
    void _accessToken;
    return NextResponse.json({ success: true, data: { ...session, reviewUrl } });
  } catch (e) {
    return handleApiError(e);
  }
}
