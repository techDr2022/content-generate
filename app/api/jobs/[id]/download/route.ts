import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { downloadJobFile } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response | NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    return await downloadJobFile(auth.sub, (await ctx.params).id);
  } catch (e) {
    return handleApiError(e);
  }
}
