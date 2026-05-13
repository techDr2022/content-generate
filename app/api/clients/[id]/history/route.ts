import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { getClientHistory } from "@/lib/server/handlers/clients";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { id } = await ctx.params;
    const data = await getClientHistory(auth.sub, id);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
