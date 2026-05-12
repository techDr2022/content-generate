import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "./errorHandler";
import type { AuthPayload } from "./auth";

export function authenticateSse(req: Request, _res: Response, next: NextFunction): void {
  const bearer =
    typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : undefined;
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  const token = bearer || queryToken;
  if (!token) {
    return next(new HttpError(401, "Missing token"));
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new HttpError(500, "JWT_SECRET is not configured"));
  }
  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.auth = decoded;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}
