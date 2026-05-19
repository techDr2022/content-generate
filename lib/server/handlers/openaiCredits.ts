import { getOpenAiCreditsSummary } from "@/lib/server/services/openaiCredits";
import {
  defaultDayInput,
  defaultMonthInput,
  type DashboardPeriod,
} from "@/lib/dashboardPeriod";

function periodBounds(
  period: DashboardPeriod,
  opts: { monthKey: string; dayKey: string; from: string; to: string }
): { from?: Date; to?: Date } {
  if (period === "all") return {};

  const now = new Date();

  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }

  if (period === "day") {
    const [y, m, d] = opts.dayKey.split("-").map(Number);
    const start = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
    const end = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (period === "month") {
    const [y, m] = opts.monthKey.split("-").map(Number);
    const start = new Date(y, (m ?? 1) - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m ?? 1, 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (period === "custom" && opts.from && opts.to) {
    const [y1, m1, d1] = opts.from.split("-").map(Number);
    const [y2, m2, d2] = opts.to.split("-").map(Number);
    const start = new Date(y1, (m1 ?? 1) - 1, d1 ?? 1, 0, 0, 0, 0);
    const end = new Date(y2, (m2 ?? 1) - 1, d2 ?? 1, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  const [y, m] = defaultMonthInput().split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m ?? 1, 0, 23, 59, 59, 999);
  return { from: start, to: end };
}

export async function handleOpenAiCredits(query: {
  period?: string;
  monthKey?: string;
  dayKey?: string;
  from?: string;
  to?: string;
}) {
  const period = (query.period ?? "month") as DashboardPeriod;
  const bounds = periodBounds(period, {
    monthKey: query.monthKey ?? defaultMonthInput(),
    dayKey: query.dayKey ?? defaultDayInput(),
    from: query.from ?? "",
    to: query.to ?? "",
  });

  const data = await getOpenAiCreditsSummary(bounds);
  return { success: true as const, data };
}
