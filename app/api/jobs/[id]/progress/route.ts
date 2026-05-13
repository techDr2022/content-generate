import { NextResponse } from "next/server";
import { requireSseAuth } from "@/lib/server/auth";
import { createJobProgressStreamResponse } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response | NextResponse> {
  try {
    const auth = requireSseAuth(req);
    return createJobProgressStreamResponse(auth.sub, (await ctx.params).id);
  } catch (e) {
    return handleApiError(e);
  }
}
