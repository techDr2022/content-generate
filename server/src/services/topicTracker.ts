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

  return rows.filter((r: TopicHistory) => {
    const delta = monthsBetween(r.year, r.month, year, month);
    return delta > 0 && delta <= 6;
  });
}

export function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isTopicUsedInHistory(topic: string, historyTopics: string[]): boolean {
  const key = normalizeTopicKey(topic);
  return historyTopics.some((t) => normalizeTopicKey(t) === key);
}
