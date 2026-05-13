import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { HttpError } from "@/lib/server/http";
import { signToken } from "@/lib/server/auth";

const TECHDR_ALLOWED_EMAILS = new Set(["contact@techdr.in", "support@techdr.in"]);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function handleRegister(): Promise<never> {
  throw new HttpError(403, "Registration is disabled");
}

export async function handleLogin(body: unknown) {
  const parsed = loginSchema.parse(body);
  const email = parsed.email.trim().toLowerCase();

  if (!TECHDR_ALLOWED_EMAILS.has(email)) {
    throw new HttpError(401, "Invalid credentials");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const ok = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials");
  }

  const token = signToken({ sub: user.id, email: user.email });
  return {
    success: true as const,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    },
  };
}

export async function handleMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  return { success: true as const, data: user };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function handleChangePassword(userId: string, body: unknown) {
  const parsed = changePasswordSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const email = user.email.trim().toLowerCase();
  if (!TECHDR_ALLOWED_EMAILS.has(email)) {
    throw new HttpError(403, "Password cannot be changed for this account");
  }

  const currentOk = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new HttpError(401, "Current password is incorrect");
  }

  if (parsed.currentPassword === parsed.newPassword) {
    throw new HttpError(400, "New password must be different from the current password");
  }

  const passwordHash = await bcrypt.hash(parsed.newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { success: true as const, data: { ok: true as const } };
}
