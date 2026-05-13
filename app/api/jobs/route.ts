import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { listJobs } from "@/lib/server/handlers/jobs";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const data = await listJobs(auth.sub);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
