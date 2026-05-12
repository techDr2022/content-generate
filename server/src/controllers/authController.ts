import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { signToken } from "../middleware/auth";

/**
 * Only these accounts may sign in. Passwords are bcrypt hashes in the DB — not stored here.
 * Initial password: set `TECHDR_PASSWORD` in `.env` and run `npm run db:seed`, or use Settings → Change password.
 */
const TECHDR_ALLOWED_EMAILS = new Set(["contact@techdr.in", "support@techdr.in"]);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(_req: Request, _res: Response): Promise<void> {
  throw new HttpError(403, "Registration is disabled");
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const email = body.email.trim().toLowerCase();

  if (!TECHDR_ALLOWED_EMAILS.has(email)) {
    throw new HttpError(401, "Invalid credentials");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials");
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    },
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  res.json({ success: true, data: user });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.auth!.sub;
  const body = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const email = user.email.trim().toLowerCase();
  if (!TECHDR_ALLOWED_EMAILS.has(email)) {
    throw new HttpError(403, "Password cannot be changed for this account");
  }

  const currentOk = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new HttpError(401, "Current password is incorrect");
  }

  if (body.currentPassword === body.newPassword) {
    throw new HttpError(400, "New password must be different from the current password");
  }

  const passwordHash = await bcrypt.hash(body.newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  res.json({ success: true, data: { ok: true } });
}
