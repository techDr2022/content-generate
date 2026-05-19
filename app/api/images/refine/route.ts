import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { refineImageFromPoster } from "@/lib/server/handlers/images";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const body = await req.json();
    const data = await refineImageFromPoster(body, auth.sub);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
