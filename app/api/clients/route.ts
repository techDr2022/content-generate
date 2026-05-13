import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { createClient, listClients } from "@/lib/server/handlers/clients";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const url = new URL(req.url);
    const data = await listClients(auth.sub, url.searchParams);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const body = await req.json();
    const data = await createClient(auth.sub, body);
    const { statusCode, ...rest } = data as typeof data & { statusCode?: number };
    return NextResponse.json(rest, { status: statusCode ?? 200 });
  } catch (e) {
    return handleApiError(e);
  }
}
