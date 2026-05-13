import { NextResponse } from "next/server";
import { handleRegister } from "@/lib/server/handlers/auth";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  try {
    await handleRegister();
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
