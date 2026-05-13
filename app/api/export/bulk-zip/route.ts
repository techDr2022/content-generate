import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { downloadBulkZip } from "@/lib/server/handlers/export";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response | NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const body = await req.json();
    return await downloadBulkZip(auth.sub, body);
  } catch (e) {
    return handleApiError(e);
  }
}
