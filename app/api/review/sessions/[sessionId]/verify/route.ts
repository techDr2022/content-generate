import { NextResponse } from "next/server";
import { verifyReviewSessionHandler } from "@/lib/server/handlers/review";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }): Promise<NextResponse> {
  try {
    const { sessionId } = await ctx.params;
    return await verifyReviewSessionHandler(sessionId, req);
  } catch (e) {
    return handleApiError(e);
  }
}
