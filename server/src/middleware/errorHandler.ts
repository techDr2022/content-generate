import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    res.status(400).json({ success: false, error: message });
    return;
  }

  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ success: false, error: message });
}
