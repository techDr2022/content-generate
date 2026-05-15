import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

export const REVIEW_SESSION_COOKIE = "hc_review_session";

export interface ReviewTokenPayload {
  sessionId: string;
  calendarId: string;
  clientId: string;
}

export interface ReviewSessionCookiePayload {
  sessionId: string;
}

export function generateReviewToken(payload: ReviewTokenPayload, expiresInHours: number): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("REVIEW_TOKEN_SECRET must be set and at least 32 characters");
  }
  const expiresInSec = Math.max(3600, Math.floor(expiresInHours * 3600));
  return jwt.sign(
    { sessionId: payload.sessionId, calendarId: payload.calendarId, clientId: payload.clientId },
    secret,
    { expiresIn: expiresInSec }
  );
}

export function verifyReviewToken(token: string): ReviewTokenPayload {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error("REVIEW_TOKEN_SECRET is not configured");
  }
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload & Partial<ReviewTokenPayload>;
  const { sessionId, calendarId, clientId } = decoded;
  if (typeof sessionId !== "string" || typeof calendarId !== "string" || typeof clientId !== "string") {
    throw new Error("Invalid review token payload");
  }
  return { sessionId, calendarId, clientId };
}

export function generatePin(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function signReviewSessionCookie(sessionId: string): string {
  const secret = process.env.REVIEW_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("REVIEW_SESSION_SECRET must be set and at least 32 characters");
  }
  const expiresInSec = 4 * 60 * 60;
  return jwt.sign({ sessionId }, secret, { expiresIn: expiresInSec });
}

export function verifyReviewSessionToken(token: string): ReviewSessionCookiePayload {
  const secret = process.env.REVIEW_SESSION_SECRET;
  if (!secret) {
    throw new Error("REVIEW_SESSION_SECRET is not configured");
  }
  const decoded = jwt.verify(token, secret) as jwt.JwtPayload & { sessionId?: string };
  if (typeof decoded.sessionId !== "string") {
    throw new Error("Invalid review session");
  }
  return { sessionId: decoded.sessionId };
}

export function getReviewSession(req: NextRequest): ReviewSessionCookiePayload | null {
  const raw = req.cookies.get(REVIEW_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return verifyReviewSessionToken(raw);
  } catch {
    return null;
  }
}

export function getReviewSessionFromRequest(req: Request): ReviewSessionCookiePayload | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(`${REVIEW_SESSION_COOKIE}=`)) {
      const raw = decodeURIComponent(p.slice(REVIEW_SESSION_COOKIE.length + 1));
      try {
        return verifyReviewSessionToken(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function reviewSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 4 * 60 * 60,
  };
}
