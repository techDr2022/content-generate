export interface ReviewInviteTemplateProps {
  clinicName: string;
  doctorName: string;
  monthName: string;
  year: number;
  expiresAt: Date;
  reviewUrl: string;
  pin: string;
  reviewEntryUrl: string;
  agencyName: string;
}

export function getReviewInviteSubject(props: Pick<ReviewInviteTemplateProps, "clinicName" | "monthName" | "year">): string {
  return `Your ${props.monthName} ${props.year} content calendar is ready for review — ${props.clinicName}`;
}

export function renderReviewInviteHtml(props: ReviewInviteTemplateProps): string {
  const expiresHuman = props.expiresAt.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const expiresDateOnly = props.expiresAt.toLocaleDateString("en-US", { dateStyle: "long" });

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #0f172a;">
  <p>Hi ${escapeHtml(props.doctorName || props.clinicName)},</p>
  <p>Your content calendar for <strong>${escapeHtml(props.monthName)} ${props.year}</strong> is ready. Please review and approve the content by <strong>${escapeHtml(expiresHuman)}</strong>.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeAttr(props.reviewUrl)}" style="display: inline-block; background: #0f766e; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">Review Content</a>
  </p>
  <p>If the button doesn&apos;t work, visit <a href="${escapeAttr(props.reviewEntryUrl)}">${escapeHtml(props.reviewEntryUrl)}</a> and enter PIN: <strong style="letter-spacing: 0.15em;">${escapeHtml(props.pin)}</strong></p>
  <p style="font-size: 14px; color: #64748b;">This link expires on ${escapeHtml(expiresDateOnly)}. Contact ${escapeHtml(props.agencyName)} if you need more time.</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
