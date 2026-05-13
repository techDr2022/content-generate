import jwt from "jsonwebtoken";
import { HttpError } from "./http";

export interface AuthPayload {
  sub: string;
  email: string;
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export function requireAuthPayload(req: Request): AuthPayload {
  const token = getBearerToken(req);
  if (!token) {
    throw new HttpError(401, "Missing or invalid authorization header");
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new HttpError(500, "JWT_SECRET is not configured");
  }
  try {
    return jwt.verify(token, secret) as AuthPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

/** SSE: Bearer header or `token` query (EventSource cannot set headers). */
export function requireSseAuth(req: Request): AuthPayload {
  const bearer = getBearerToken(req);
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const token = bearer || queryToken;
  if (!token) {
    throw new HttpError(401, "Missing token");
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new HttpError(500, "JWT_SECRET is not configured");
  }
  try {
    return jwt.verify(token, secret) as AuthPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return jwt.sign({ sub: payload.sub, email: payload.email }, secret, { expiresIn } as jwt.SignOptions);
}
