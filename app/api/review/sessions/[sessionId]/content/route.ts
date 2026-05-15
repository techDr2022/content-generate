import { NextResponse } from "next/server";
import { getReviewContentHandler } from "@/lib/server/handlers/review";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<NextResponse> {
  try {
    const { sessionId } = await ctx.params;
    const data = await getReviewContentHandler(req, sessionId);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
