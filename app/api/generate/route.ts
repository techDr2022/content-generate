import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { enqueueGenerate } from "@/lib/server/handlers/generate";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const body = await req.json();
    const data = await enqueueGenerate(auth.sub, body);
    const { statusCode, ...rest } = data;
    return NextResponse.json(rest, { status: statusCode ?? 200 });
  } catch (e) {
    return handleApiError(e);
  }
}
