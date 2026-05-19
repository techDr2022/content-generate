import type { GenerationJobDTO } from "@/lib/types";

export type DashboardPeriod = "all" | "week" | "month" | "day" | "custom";

/** Local calendar day start (00:00:00.000). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar day end (23:59:59.999). */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Week starts Sunday (local). */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export function endOfWeek(d: Date): Date {
  const e = startOfWeek(d);
  e.setDate(e.getDate() + 6);
  return endOfDay(e);
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseMonthInput(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month: month - 1 };
}

export function defaultMonthInput(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function defaultDayInput(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function periodLabel(period: DashboardPeriod, opts: { monthKey: string; dayKey: string }): string {
  switch (period) {
    case "all":
      return "All time";
    case "week":
      return "This week";
    case "month": {
      const p = parseMonthInput(opts.monthKey);
      if (!p) return "Selected month";
      return new Date(p.year, p.month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
    }
    case "day": {
      const d = parseDateInput(opts.dayKey);
      return d ? d.toLocaleDateString() : "Selected day";
    }
    case "custom":
      return "Custom range";
    default:
      return "All time";
  }
}

export function jobCreatedInPeriod(
  job: Pick<GenerationJobDTO, "createdAt">,
  period: DashboardPeriod,
  opts: { monthKey: string; dayKey: string; from: string; to: string }
): boolean {
  const created = new Date(job.createdAt);
  const t = created.getTime();
  if (Number.isNaN(t)) return false;

  const now = new Date();

  if (period === "all") return true;

  if (period === "week") {
    return t >= startOfWeek(now).getTime() && t <= endOfWeek(now).getTime();
  }

  if (period === "month") {
    const p = parseMonthInput(opts.monthKey) ?? { year: now.getFullYear(), month: now.getMonth() };
    return created.getFullYear() === p.year && created.getMonth() === p.month;
  }

  if (period === "day") {
    const day = parseDateInput(opts.dayKey) ?? startOfDay(now);
    return t >= startOfDay(day).getTime() && t <= endOfDay(day).getTime();
  }

  if (period === "custom") {
    if (opts.from) {
      const from = parseDateInput(opts.from);
      if (from && t < startOfDay(from).getTime()) return false;
    }
    if (opts.to) {
      const to = parseDateInput(opts.to);
      if (to && t > endOfDay(to).getTime()) return false;
    }
    return true;
  }

  return true;
}
