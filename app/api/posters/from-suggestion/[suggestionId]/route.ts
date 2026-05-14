import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { buildPosterPrefillFromSuggestion } from "@/lib/server/handlers/trendingNewsSuggestions";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ suggestionId: string }> }
): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { suggestionId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const data = await buildPosterPrefillFromSuggestion(auth.sub, suggestionId, body);
    return NextResponse.json({ success: true as const, data });
  } catch (e) {
    return handleApiError(e);
  }
}
