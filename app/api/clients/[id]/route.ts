import { NextResponse } from "next/server";
import { requireAuthPayload } from "@/lib/server/auth";
import { deleteClient, getClient, updateClient } from "@/lib/server/handlers/clients";
import { handleApiError } from "@/lib/server/routeHelpers";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { id } = await ctx.params;
    const data = await getClient(auth.sub, id);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await updateClient(auth.sub, id, body);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const auth = requireAuthPayload(req);
    const { id } = await ctx.params;
    const data = await deleteClient(auth.sub, id);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}
