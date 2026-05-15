import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/routeHelpers";
import { resendReviewSessionHandler } from "@/lib/server/handlers/review";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { sessionId } = await ctx.params;
    const data = await resendReviewSessionHandler(auth.sub, sessionId);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
