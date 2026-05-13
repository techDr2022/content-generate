import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { previewJobCalendar } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const data = await previewJobCalendar(auth.sub, (await ctx.params).id);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
