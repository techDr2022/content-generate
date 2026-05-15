"use client";

import { cn } from "@/lib/utils";

interface ReviewProgressBarProps {
  reviewed: number;
  total: number;
  className?: string;
}

export function ReviewProgressBar({ reviewed, total, className }: ReviewProgressBarProps): JSX.Element {
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const done = Math.min(reviewed, total);
  const pending = Math.max(0, total - done);
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {done} of {total} reviewed
        </span>
        <span>{pct}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="bg-emerald-500 transition-all duration-300"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
        <div
          className="bg-slate-300 transition-all duration-300"
          style={{ width: `${total ? (pending / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
