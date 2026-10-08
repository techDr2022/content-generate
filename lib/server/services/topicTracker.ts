import type { PrismaClient, TopicHistory } from "@prisma/client";

export function monthsBetween(
  y1: number,
  m1: number,
  y2: number,
  m2: number
): number {
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Returns topic history rows for the 6 calendar months strictly before (year, month).
 */
function inSixMonthWindow(row: TopicHistory, year: number, month: number): boolean {
  const delta = monthsBetween(row.year, row.month, year, month);
  return delta > 0 && delta <= 6;
}

export async function fetchTopicHistoryLastSixMonths(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
) {
  const rows = await prisma.topicHistory.findMany({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return rows.filter((r: TopicHistory) => inSixMonthWindow(r, year, month));
}

/** Cap so the prompt stays usable when the network history is large. */
const GLOBAL_HISTORY_CAP = 80;

/**
 * Topics generated for other TechDr clients in the prior 6 months.
 * Same-specialty rows are kept first — those are the duplicates doctors notice.
 */
export async function fetchGlobalTopicHistoryLastSixMonths(
  prisma: PrismaClient,
  excludeClientId: string,
  year: number,
  month: number,
  specialties: string[]
) {
  const rows = await prisma.topicHistory.findMany({
    where: { clientId: { not: excludeClientId } },
    include: { client: { select: { name: true, specialty: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    take: 800,
  });

  const inWindow = rows.filter((r) => inSixMonthWindow(r, year, month));
  const spec = new Set(specialties.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const sameSpecialty: typeof inWindow = [];
  const other: typeof inWindow = [];
  for (const row of inWindow) {
    const overlap = row.client.specialty.some((s) => spec.has(s.trim().toLowerCase()));
    if (overlap) sameSpecialty.push(row);
    else other.push(row);
  }

  return [...sameSpecialty, ...other].slice(0, GLOBAL_HISTORY_CAP);
}

export function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isTopicUsedInHistory(topic: string, historyTopics: string[]): boolean {
  const key = normalizeTopicKey(topic);
  return historyTopics.some((t) => normalizeTopicKey(t) === key);
}
