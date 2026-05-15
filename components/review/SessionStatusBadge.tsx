"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-slate-100 text-slate-800 border-slate-200" },
  OPENED: { label: "Opened", className: "bg-sky-100 text-sky-900 border-sky-200" },
  IN_REVIEW: { label: "In review", className: "bg-amber-100 text-amber-950 border-amber-200" },
  SUBMITTED: { label: "Submitted", className: "bg-emerald-100 text-emerald-950 border-emerald-200" },
  EXPIRED: { label: "Expired", className: "bg-rose-100 text-rose-950 border-rose-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-950 border-emerald-200" },
  APPROVED_WITH_EDITS: { label: "Approved w/ edits", className: "bg-amber-100 text-amber-950 border-amber-200" },
  REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-950 border-rose-200" },
};

export function SessionStatusBadge({ status }: { status: string }): JSX.Element {
  const m = map[status] ?? { label: status, className: "bg-slate-100 text-slate-800" };
  return (
    <Badge variant="outline" className={cn("font-medium", m.className)}>
      {m.label}
    </Badge>
  );
}
