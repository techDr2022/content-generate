import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { HttpError } from "./http";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "An unexpected error occurred";
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return NextResponse.json({ success: false, error: message }, { status });
}
