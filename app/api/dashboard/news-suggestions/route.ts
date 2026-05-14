import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { listDashboardNewsSuggestions } from "@/lib/server/handlers/trendingNewsSuggestions";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const url = new URL(req.url);
    const data = await listDashboardNewsSuggestions(auth.sub, url.searchParams);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
