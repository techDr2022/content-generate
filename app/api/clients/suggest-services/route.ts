import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { suggestServices } from "@/lib/server/handlers/suggestServices";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    requireAuthPayload(req);
    const body = await req.json();
    const data = await suggestServices(body);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
