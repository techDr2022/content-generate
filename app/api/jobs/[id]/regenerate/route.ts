import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { regenerateJob } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const data = await regenerateJob(auth.sub, (await ctx.params).id, body);
    const { statusCode, ...rest } = data;
    return NextResponse.json(rest, { status: statusCode ?? 200 });
  } catch (e) {
    return handleApiError(e);
  }
}
