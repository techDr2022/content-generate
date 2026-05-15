import { NextResponse } from "next/server";
import { updatePostFeedbackHandler } from "@/lib/server/handlers/review";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ sessionId: string; postId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId, postId } = await ctx.params;
    const body = await req.json();
    const data = await updatePostFeedbackHandler(req, sessionId, postId, body);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
