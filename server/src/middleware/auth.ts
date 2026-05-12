import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { HttpError } from "./errorHandler";

export interface AuthPayload {
  sub: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing or invalid authorization header"));
  }
  const token = header.slice("Bearer ".length);
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

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return jwt.sign(
    { sub: payload.sub, email: payload.email },
    secret,
    { expiresIn } as jwt.SignOptions
  );
}
