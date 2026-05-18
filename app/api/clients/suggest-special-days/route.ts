import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { suggestClientSpecialDays } from "@/lib/server/handlers/suggestClientSpecialDays";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    requireAuthPayload(req);
    const body = await req.json();
    const data = await suggestClientSpecialDays(body);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
