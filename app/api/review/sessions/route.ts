import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/server/routeHelpers";
import { createReviewSessionHandler, listReviewSessionsHandler, requireInternalAuth } from "@/lib/server/handlers/review";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const auth = requireInternalAuth(req);
    const body = await req.json();
    const data = await createReviewSessionHandler(auth.sub, body);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const auth = requireInternalAuth(req);
    const url = new URL(req.url);
    const data = await listReviewSessionsHandler(auth.sub, url.searchParams);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
