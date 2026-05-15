import { NextResponse } from "next/server";
import { submitReviewSessionHandler } from "@/lib/server/handlers/review";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<NextResponse> {
  try {
    const { sessionId } = await ctx.params;
    const data = await submitReviewSessionHandler(req, sessionId);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
