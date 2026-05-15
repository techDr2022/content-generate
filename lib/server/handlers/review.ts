import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { PostFeedback, PostFeedbackStatus, Prisma, ReviewSessionStatus } from "@prisma/client";
import { requireAuthPayload } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { syncCalendarPostsFromJob } from "@/lib/server/services/reviewCalendarSync";
import { presignPosterObjectKey } from "@/lib/server/services/reviewPosterSign";
import {
  generatePin,
  generateReviewToken,
  getReviewSessionFromRequest,
  hashPin,
  reviewSessionCookieOptions,
  REVIEW_SESSION_COOKIE,
  signReviewSessionCookie,
  verifyPin,
  verifyReviewToken,
} from "@/lib/review-auth";
import {
  createReviewSessionBodySchema,
  updatePostFeedbackBodySchema,
} from "@/lib/validations/review";
import { checkReviewVerifyRateLimit } from "@/lib/server/reviewVerifyRateLimit";
import { getReviewInviteSubject, renderReviewInviteHtml } from "@/emails/review-invite";

export function requireInternalAuth(req: Request) {
  return requireAuthPayload(req);
}

export function requireReviewSessionCookie(req: Request, sessionId: string): void {
  const payload = getReviewSessionFromRequest(req);
  if (!payload || payload.sessionId !== sessionId) {
    throw new HttpError(401, "Review session required");
  }
}

export function getReviewBaseUrl(): string {
  const u = process.env.REVIEW_BASE_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

function agencyName(): string {
  return process.env.AGENCY_DISPLAY_NAME?.trim() || "your content team";
}

async function sendReviewEmail(to: string, html: string, subject: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.info("[review-email]", { to, subject, htmlLength: html.length });
}

async function logSession(
  sessionId: string,
  event: string,
  postId?: string | null,
  metadata?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.reviewSessionLog.create({
    data: {
      sessionId,
      event,
      postId: postId ?? undefined,
      metadata,
    },
  });
}

export async function createReviewSessionHandler(userId: string, body: unknown) {
  const parsed = createReviewSessionBodySchema.parse(body ?? {});
  const expiresInHours = parsed.expiresInHours ?? 72;

  const job = await prisma.generationJob.findFirst({
    where: {
      id: parsed.calendarId,
      userId,
      status: "done",
    },
    include: { client: true },
  });
  if (!job) {
    throw new HttpError(404, "Completed calendar not found for your account.");
  }

  await syncCalendarPostsFromJob(job.id);

  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);
  const pinPlain = generatePin();
  const pinHash = await hashPin(pinPlain);

  const placeholderToken = `pending_${createHash("sha256").update(randomBytes(32)).digest("hex")}`;

  const session = await prisma.$transaction(async (tx) => {
    const draft = await tx.clientReviewSession.create({
      data: {
        clientId: job.clientId,
        calendarId: job.id,
        createdByUserId: userId,
        accessToken: placeholderToken,
        pin: pinHash,
        email: parsed.email,
        expiresAt,
        status: "PENDING",
      },
    });
    const token = generateReviewToken(
      { sessionId: draft.id, calendarId: job.id, clientId: job.clientId },
      expiresInHours
    );
    const updated = await tx.clientReviewSession.update({
      where: { id: draft.id },
      data: { accessToken: token },
    });
    return updated;
  });

  const reviewUrl = `${getReviewBaseUrl()}/review/${session.id}?token=${encodeURIComponent(session.accessToken)}`;
  const monthName = new Date(job.year, job.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const subject = getReviewInviteSubject({
    clinicName: job.client.clinicName,
    monthName,
    year: job.year,
  });
  const html = renderReviewInviteHtml({
    clinicName: job.client.clinicName,
    doctorName: job.client.doctorName,
    monthName,
    year: job.year,
    expiresAt,
    reviewUrl,
    pin: pinPlain,
    reviewEntryUrl: `${getReviewBaseUrl()}/review/${session.id}`,
    agencyName: agencyName(),
  });

  await sendReviewEmail(parsed.email, html, subject);

  return {
    sessionId: session.id,
    reviewUrl,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function verifyReviewSessionHandler(sessionId: string, req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  const pin = url.searchParams.get("pin")?.trim();

  const session = await prisma.clientReviewSession.findUnique({
    where: { id: sessionId },
    include: {
      calendar: { include: { job: true, client: true } },
    },
  });

  const fail = async (event: string, status: number, message: string, meta?: Prisma.InputJsonValue) => {
    if (session) {
      await logSession(session.id, event, null, meta ?? { message });
    }
    return NextResponse.json({ valid: false, error: message }, { status });
  };

  if (!session) {
    return NextResponse.json({ valid: false, error: "Session not found" }, { status: 404 });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.clientReviewSession.updateMany({
      where: { id: sessionId, status: { not: "SUBMITTED" } },
      data: { status: "EXPIRED" },
    });
    return fail("verify_failure_expired", 410, "This review link has expired.");
  }

  if (session.status === "SUBMITTED") {
    return fail("verify_failure_submitted", 400, "This review has already been submitted.");
  }

  const rl = await checkReviewVerifyRateLimit(sessionId);
  if (!rl.allowed) {
    await logSession(session.id, "verify_rate_limited", null, {});
    return fail("verify_rate_limited", 429, "Too many attempts. Try again in a few minutes.");
  }

  let ok = false;
  if (token) {
    try {
      const payload = verifyReviewToken(token);
      if (
        payload.sessionId !== sessionId ||
        payload.calendarId !== session.calendarId ||
        payload.clientId !== session.clientId
      ) {
        await logSession(session.id, "verify_failure_token", null, { reason: "payload_mismatch" });
        return fail("verify_failure_token", 401, "Invalid or expired link.");
      }
      if (session.accessToken !== token) {
        await logSession(session.id, "verify_failure_token", null, { reason: "superseded" });
        return fail("verify_failure_token", 401, "This link is no longer active. Request a new invite.");
      }
      ok = true;
    } catch {
      await logSession(session.id, "verify_failure_token", null, { reason: "jwt" });
      return fail("verify_failure_token", 401, "Invalid or expired link.");
    }
  } else if (pin && /^\d{6}$/.test(pin)) {
    if (!session.pin) {
      return fail("verify_failure_pin", 401, "PIN not available for this session.");
    }
    ok = await verifyPin(pin, session.pin);
    if (!ok) {
      await logSession(session.id, "verify_failure_pin", null, {});
      return fail("verify_failure_pin", 401, "Incorrect PIN.");
    }
  } else {
    return fail("verify_failure_missing", 400, "Provide a valid token or 6-digit PIN.");
  }

  const cookieToken = signReviewSessionCookie(session.id);
  const monthName = new Date(session.calendar.year, session.calendar.month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });

  await prisma.clientReviewSession.update({
    where: { id: sessionId },
    data: {
      lastAccessedAt: new Date(),
      status: session.status === "PENDING" ? "OPENED" : session.status,
    },
  });
  await logSession(session.id, "verify_success", null, { via: token ? "token" : "pin" });

  const res = NextResponse.json({
    valid: true,
    clientName: session.calendar.client.clinicName,
    calendarMonth: monthName,
    calendarYear: session.calendar.year,
  });
  res.cookies.set(REVIEW_SESSION_COOKIE, cookieToken, reviewSessionCookieOptions());
  return res;
}

function mapPostTypeBadge(postType: string, specialDay: string | null): string {
  if (specialDay?.trim()) return "Special Day";
  if (postType === "Carousel") return "Carousel";
  return "Poster";
}

function feedbackStats(posts: { feedback: PostFeedback | null }[]) {
  let approved = 0;
  let approvedWithEdits = 0;
  let rejected = 0;
  let pending = 0;
  for (const p of posts) {
    const s = p.feedback?.status ?? "PENDING";
    if (s === "APPROVED") approved++;
    else if (s === "APPROVED_WITH_EDITS") approvedWithEdits++;
    else if (s === "REJECTED") rejected++;
    else pending++;
  }
  return {
    total: posts.length,
    approved,
    approvedWithEdits,
    rejected,
    pending,
  };
}

export async function getReviewContentHandler(req: Request, sessionId: string) {
  requireReviewSessionCookie(req, sessionId);

  const session = await prisma.clientReviewSession.findUnique({
    where: { id: sessionId },
    include: {
      calendar: {
        include: {
          client: { select: { clinicName: true, specialty: true, doctorName: true } },
          posts: {
            orderBy: { rowIndex: "asc" },
            include: {
              feedback: { where: { sessionId } },
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new HttpError(404, "Session not found");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, "This review session has expired.");
  }

  const opened = await prisma.reviewSessionLog.findFirst({
    where: { sessionId, event: "session_opened" },
  });
  if (!opened) {
    await logSession(sessionId, "session_opened", null, {});
  }

  if (session.status !== "SUBMITTED" && session.status !== "EXPIRED") {
    await prisma.clientReviewSession.update({
      where: { id: sessionId },
      data: { status: "IN_REVIEW" },
    });
  }

  const postsOut = [];
  for (const p of session.calendar.posts) {
    const feedback = p.feedback[0] ?? null;
    const posterUrl = await presignPosterObjectKey(p.posterObjectKey);
    postsOut.push({
      id: p.id,
      date: p.date,
      type: mapPostTypeBadge(p.postType, p.specialDay),
      postType: p.postType,
      caption: p.caption,
      hashtags: p.hashtags,
      specialDay: p.specialDay,
      posterUrl,
      feedback,
    });
  }

  const stats = feedbackStats(
    session.calendar.posts.map((p) => ({ feedback: p.feedback[0] ?? null }))
  );

  const fresh = await prisma.clientReviewSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  return {
    calendar: {
      month: new Date(session.calendar.year, session.calendar.month - 1, 1).toLocaleString("en-US", {
        month: "long",
      }),
      year: session.calendar.year,
      clientName: session.calendar.client.clinicName,
      specialty: session.calendar.client.specialty,
    },
    posts: postsOut,
    sessionStatus: fresh?.status ?? session.status,
    stats,
  };
}

function assertFeedbackRules(status: PostFeedbackStatus, body: import("@/lib/validations/review").UpdatePostFeedbackBody) {
  if (status === "REJECTED" && !body.rejectionReason?.trim()) {
    throw new HttpError(400, "Rejection reason is required.");
  }
  if (status === "APPROVED_WITH_EDITS") {
    if (!body.editedCaption?.trim() && !body.editedHashtags?.trim()) {
      throw new HttpError(400, "Approve with edits requires edited caption or hashtags.");
    }
  }
}

export async function updatePostFeedbackHandler(
  req: Request,
  sessionId: string,
  postId: string,
  body: unknown
): Promise<PostFeedback> {
  requireReviewSessionCookie(req, sessionId);
  const parsed = updatePostFeedbackBodySchema.parse(body ?? {});

  const session = await prisma.clientReviewSession.findUnique({
    where: { id: sessionId },
    select: { status: true, expiresAt: true, calendarId: true },
  });
  if (!session) {
    throw new HttpError(404, "Session not found");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, "This review session has expired.");
  }
  if (session.status === "SUBMITTED") {
    throw new HttpError(400, "This review has already been submitted.");
  }

  assertFeedbackRules(parsed.status, parsed);

  const post = await prisma.post.findFirst({
    where: { id: postId, calendarId: session.calendarId },
  });
  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  const data: Prisma.PostFeedbackUncheckedUpdateInput = {
    sessionId,
    postId,
    status: parsed.status,
    editedCaption: parsed.editedCaption ?? null,
    editedHashtags: parsed.editedHashtags ?? null,
    rejectionReason: parsed.rejectionReason ?? null,
    clientNote: parsed.clientNote ?? null,
  };

  const row = await prisma.postFeedback.upsert({
    where: { sessionId_postId: { sessionId, postId } },
    create: data as Prisma.PostFeedbackUncheckedCreateInput,
    update: {
      status: parsed.status,
      editedCaption: parsed.editedCaption ?? null,
      editedHashtags: parsed.editedHashtags ?? null,
      rejectionReason: parsed.rejectionReason ?? null,
      clientNote: parsed.clientNote ?? null,
    },
  });

  await logSession(sessionId, `post_${parsed.status.toLowerCase()}`, postId, {});

  return row;
}

export async function submitReviewSessionHandler(req: Request, sessionId: string) {
  requireReviewSessionCookie(req, sessionId);

  const session = await prisma.clientReviewSession.findUnique({
    where: { id: sessionId },
    include: {
      calendar: {
        include: {
          client: { select: { clinicName: true } },
          posts: {
            include: {
              feedback: { where: { sessionId } },
            },
          },
        },
      },
    },
  });
  if (!session) {
    throw new HttpError(404, "Session not found");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, "This review session has expired.");
  }
  if (session.status === "SUBMITTED") {
    throw new HttpError(400, "Already submitted.");
  }

  for (const p of session.calendar.posts) {
    const fb = p.feedback[0];
    if (!fb || fb.status === "PENDING") {
      throw new HttpError(400, "Every post must be reviewed before submitting.");
    }
  }

  await prisma.clientReviewSession.update({
    where: { id: sessionId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  await logSession(sessionId, "session_submitted", null, {});

  const summary = feedbackStats(
    session.calendar.posts.map((p) => ({ feedback: p.feedback[0] ?? null }))
  );

  const creator = await prisma.user.findUnique({
    where: { id: session.createdByUserId },
    select: { email: true, name: true },
  });
  if (creator?.email) {
    const subject = `Review submitted — ${session.calendar.client.clinicName}`;
    const html = `<p>Hi ${creator.name},</p><p>The client submitted their review for ${session.calendar.client.clinicName} (${session.calendar.month}/${session.calendar.year}).</p><p>Approved: ${summary.approved}, with edits: ${summary.approvedWithEdits}, rejected: ${summary.rejected}.</p>`;
    await sendReviewEmail(creator.email, html, subject);
  }

  return {
    submitted: true,
    summary: {
      approved: summary.approved,
      approvedWithEdits: summary.approvedWithEdits,
      rejected: summary.rejected,
    },
  };
}

export async function listReviewSessionsHandler(
  userId: string,
  search: URLSearchParams
): Promise<{
  items: unknown[];
  page: number;
  limit: number;
  total: number;
}> {
  const activeOnly = search.get("activeOnly") === "true";
  const clientId = search.get("clientId")?.trim();
  const calendarId = search.get("calendarId")?.trim();
  const status = search.get("status")?.trim() as ReviewSessionStatus | undefined;
  const page = Math.max(1, Number(search.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(search.get("limit") ?? "20") || 20));

  const where: Prisma.ClientReviewSessionWhereInput = {
    calendar: { job: { userId } },
    ...(clientId ? { clientId } : {}),
    ...(calendarId ? { calendarId } : {}),
    ...(activeOnly ? { status: { in: ["PENDING", "OPENED", "IN_REVIEW"] } } : {}),
    ...(status && !activeOnly ? { status } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.clientReviewSession.count({ where }),
    prisma.clientReviewSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: { select: { name: true, clinicName: true } },
        calendar: {
          select: {
            month: true,
            year: true,
            _count: { select: { posts: true } },
          },
        },
        postFeedbacks: { select: { status: true } },
      },
    }),
  ]);

  const items = rows.map((r) => {
    const totalPosts = r.calendar._count.posts;
    let approved = 0;
    let approvedWithEdits = 0;
    let rejected = 0;
    let pendingFeedback = 0;
    for (const f of r.postFeedbacks) {
      if (f.status === "APPROVED") approved++;
      else if (f.status === "APPROVED_WITH_EDITS") approvedWithEdits++;
      else if (f.status === "REJECTED") rejected++;
      else pendingFeedback++;
    }
    const missing = Math.max(0, totalPosts - r.postFeedbacks.length);
    const pending = pendingFeedback + missing;
    const reviewed = approved + approvedWithEdits + rejected;
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.clinicName,
      calendarId: r.calendarId,
      calendarMonth: r.calendar.month,
      calendarYear: r.calendar.year,
      status: r.status,
      email: r.email,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt,
      progress: { reviewed, total: totalPosts },
      stats: {
        total: totalPosts,
        approved,
        approvedWithEdits,
        rejected,
        pending,
      },
      reviewUrl: `${getReviewBaseUrl()}/review/${r.id}?token=${encodeURIComponent(r.accessToken)}`,
    };
  });

  return { items, page, limit, total };
}

export async function getReviewSessionDetailInternal(userId: string, sessionId: string) {
  const row = await prisma.clientReviewSession.findFirst({
    where: { id: sessionId, calendar: { job: { userId } } },
    include: {
      client: true,
      calendar: { include: { job: { select: { id: true, month: true, year: true, status: true } } } },
      postFeedbacks: {
        include: {
          post: true,
        },
        orderBy: { post: { rowIndex: "asc" } },
      },
      sessionLogs: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) {
    throw new HttpError(404, "Session not found");
  }
  return row;
}

export async function resendReviewSessionHandler(userId: string, sessionId: string) {
  const session = await prisma.clientReviewSession.findFirst({
    where: { id: sessionId, calendar: { job: { userId } } },
    include: { calendar: { include: { client: true, job: true } } },
  });
  if (!session) {
    throw new HttpError(404, "Session not found");
  }
  if (session.status === "SUBMITTED") {
    throw new HttpError(400, "Cannot resend a submitted review.");
  }

  const extendMs = 72 * 3600 * 1000;
  const expiresAt = new Date(Math.max(session.expiresAt.getTime(), Date.now()) + extendMs);
  const hours = Math.ceil((expiresAt.getTime() - Date.now()) / (3600 * 1000));
  const pinPlain = generatePin();
  const pinHash = await hashPin(pinPlain);
  const token = generateReviewToken(
    { sessionId: session.id, calendarId: session.calendarId, clientId: session.clientId },
    hours
  );

  await prisma.clientReviewSession.update({
    where: { id: sessionId },
    data: {
      accessToken: token,
      pin: pinHash,
      expiresAt,
      status: session.status === "EXPIRED" ? "PENDING" : session.status,
    },
  });

  const job = session.calendar.job;
  const reviewUrl = `${getReviewBaseUrl()}/review/${session.id}?token=${encodeURIComponent(token)}`;
  const monthName = new Date(job.year, job.month - 1, 1).toLocaleString("en-US", { month: "long" });
  const subject = getReviewInviteSubject({
    clinicName: session.calendar.client.clinicName,
    monthName,
    year: job.year,
  });
  const html = renderReviewInviteHtml({
    clinicName: session.calendar.client.clinicName,
    doctorName: session.calendar.client.doctorName,
    monthName,
    year: job.year,
    expiresAt,
    reviewUrl,
    pin: pinPlain,
    reviewEntryUrl: `${getReviewBaseUrl()}/review/${session.id}`,
    agencyName: agencyName(),
  });
  if (session.email) {
    await sendReviewEmail(session.email, html, subject);
  }
  await logSession(sessionId, "session_resent", null, {});

  return { sessionId, reviewUrl, expiresAt };
}

export async function exportReviewSessionWorkbook(userId: string, sessionId: string): Promise<Buffer> {
  const row = await getReviewSessionDetailInternal(userId, sessionId);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Post feedback");
  ws.columns = [
    { header: "Post date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 14 },
    { header: "Status", key: "status", width: 22 },
    { header: "Original caption", key: "origCap", width: 48 },
    { header: "Edited caption", key: "editCap", width: 48 },
    { header: "Original hashtags", key: "origHash", width: 32 },
    { header: "Edited hashtags", key: "editHash", width: 32 },
    { header: "Rejection reason", key: "rej", width: 36 },
    { header: "Client note", key: "note", width: 36 },
  ];
  for (const fb of row.postFeedbacks) {
    ws.addRow({
      date: fb.post.date,
      type: fb.post.postType,
      status: fb.status,
      origCap: fb.post.caption,
      editCap: fb.editedCaption ?? "",
      origHash: fb.post.hashtags,
      editHash: fb.editedHashtags ?? "",
      rej: fb.rejectionReason ?? "",
      note: fb.clientNote ?? "",
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function countActiveSessionsForCalendar(calendarId: string, userId: string): Promise<number> {
  return prisma.clientReviewSession.count({
    where: {
      calendarId,
      calendar: { job: { userId } },
      status: { in: ["PENDING", "OPENED", "IN_REVIEW"] },
    },
  });
}
