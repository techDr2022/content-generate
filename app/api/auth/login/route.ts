import { NextResponse } from "next/server";
import { handleLogin, handleRegister } from "@/lib/server/handlers/auth";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const data = await handleLogin(body);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
