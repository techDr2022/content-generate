import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { handleOpenAiCredits } from "@/lib/server/handlers/openaiCredits";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    requireAuthPayload(req);
    const url = new URL(req.url);
    const data = await handleOpenAiCredits({
      period: url.searchParams.get("period") ?? undefined,
      monthKey: url.searchParams.get("monthKey") ?? undefined,
      dayKey: url.searchParams.get("dayKey") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
