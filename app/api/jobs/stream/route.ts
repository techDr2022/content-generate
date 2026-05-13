import { NextResponse } from "next/server";
import { requireSseAuth } from "@/lib/server/auth";
import { createJobStreamResponse } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response | NextResponse> {
  try {
    const auth = requireSseAuth(req);
    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("userId");
    if (!userIdParam) {
      return NextResponse.json({ success: false, error: "userId query parameter is required" }, { status: 400 });
    }
    if (auth.sub !== userIdParam) {
      return NextResponse.json({ success: false, error: "userId query must match authenticated user" }, { status: 403 });
    }
    return createJobStreamResponse(auth.sub);
  } catch (e) {
    return handleApiError(e);
  }
}
