import { createHash } from "node:crypto";
import axios from "axios";
import Parser from "rss-parser";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { inferSpecialtyTagsFromHeadline } from "@/lib/server/services/trendingNewsSpecialties";
import { generateNewsPosterSuggestionWithClaude } from "@/lib/server/services/newsSuggestionClaude";

const INGESTION_ID = "default";
const STALE_MS = 6 * 60 * 60 * 1000;
const WINDOW_MS = 72 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 14_000;

export interface RawArticle {
  title: string;
  url: string;
  sourceName: string;
  summary: string;
  publishedAt: Date;
  authority: number;
}

const RSS_FEEDS: { url: string; name: string; authority: number }[] = [
  { url: "https://www.thelancet.com/rssfeed/lancet_current.xml", name: "The Lancet", authority: 1 },
  { url: "https://www.nejm.org/action/showFeed?type=etoc&jc=nejm", name: "NEJM", authority: 1 },
  { url: "https://www.bmj.com/rss/current.xml", name: "BMJ", authority: 1 },
  { url: "https://jamanetwork.com/rss/site_1/jama.xml", name: "JAMA", authority: 1 },
  { url: "https://www.who.int/rss-feeds/news-english.xml", name: "WHO", authority: 1 },
  { url: "https://tools.cdc.gov/api/v2/resources/media/132608.rss", name: "CDC", authority: 0.95 },
  { url: "https://www.endocrine.org/rss/news.xml", name: "Endocrine Society", authority: 0.9 },
  { url: "https://www.ama-assn.org/rss.xml", name: "AMA", authority: 0.85 },
  {
    url: "https://news.google.com/rss/search?q=healthcare+OR+medical+OR+hospital&hl=en-US&gl=US&ceid=US:en",
    name: "Google News (Health)",
    authority: 0.55,
  },
];

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clusterIdFromTitle(title: string): string {
  const n = normalizeTitleKey(title);
  return createHash("sha1").update(n).digest("hex").slice(0, 20);
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "over",
  "than",
  "are",
  "was",
  "has",
  "have",
  "had",
  "not",
  "but",
  "its",
  "also",
  "new",
  "may",
  "can",
  "how",
  "why",
  "all",
  "any",
  "out",
]);

function tokenize(title: string): Set<string> {
  const words = normalizeTitleKey(title).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function hoursSince(d: Date): number {
  return (Date.now() - d.getTime()) / (60 * 60 * 1000);
}

function recencyScore(hours: number): number {
  if (!Number.isFinite(hours) || hours < 0) return 0.5;
  return Math.max(0, Math.min(1, 1 - hours / 72));
}

function patientRelevance(title: string, summary: string): number {
  const s = `${title} ${summary}`.toLowerCase();
  let score = 0.35;
  if (
    /\b(patient|symptom|screening|vaccine|vaccination|outbreak|study|trial|therapy|treatment|risk|guideline|warning|diagnos|heart|diabetes|cancer|stroke|mental|pregnancy|women|men|child|infant|public\s+health)\b/i.test(
      s
    )
  ) {
    score += 0.4;
  }
  if (/\b(you|your|family|community)\b/i.test(s)) score += 0.15;
  return Math.min(1, score);
}

function combinedScore(a: RawArticle): number {
  const h = hoursSince(a.publishedAt);
  const rec = recencyScore(h);
  const pat = patientRelevance(a.title, a.summary);
  const auth = a.authority;
  return auth * 0.4 + rec * 0.35 + pat * 0.25;
}

function clusterArticles(articles: RawArticle[]): RawArticle[][] {
  const sorted = [...articles].sort((x, y) => combinedScore(y) - combinedScore(x));
  const clusters: RawArticle[][] = [];
  const reps: RawArticle[] = [];
  for (const a of sorted) {
    let idx = -1;
    for (let i = 0; i < reps.length; i++) {
      if (jaccard(tokenize(a.title), tokenize(reps[i]!.title)) >= 0.32) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      clusters.push([a]);
      reps.push(a);
    } else {
      clusters[idx]!.push(a);
    }
  }
  return clusters;
}

function pickCanonical(cluster: RawArticle[]): RawArticle {
  return [...cluster].sort((a, b) => {
    if (b.authority !== a.authority) return b.authority - a.authority;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  })[0]!;
}

function mergeCluster(cluster: RawArticle[]): {
  primary: RawArticle;
  sources: { name: string; url: string; publishedAt: Date }[];
  summary: string;
} {
  const primary = pickCanonical(cluster);
  const seen = new Set<string>();
  const sources: { name: string; url: string; publishedAt: Date }[] = [];
  for (const a of cluster) {
    const key = a.url.split("?")[0] ?? a.url;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ name: a.sourceName, url: a.url, publishedAt: a.publishedAt });
  }
  sources.sort((x, y) => y.publishedAt.getTime() - x.publishedAt.getTime());
  const summary =
    cluster
      .map((c) => c.summary)
      .find((s) => s.trim().length > 40) ?? cluster.map((c) => c.title).join(" · ");
  return { primary, sources, summary: summary.slice(0, 1200) };
}

async function fetchText(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: FETCH_TIMEOUT_MS,
    responseType: "text",
    headers: {
      "User-Agent": "TechDr-content-calendar/1.0 (+https://techdr.in)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return res.data;
}

async function parseRssFeed(entry: { url: string; name: string; authority: number }): Promise<RawArticle[]> {
  const parser = new Parser({
    timeout: FETCH_TIMEOUT_MS,
    headers: {
      "User-Agent": "TechDr-content-calendar/1.0 (+https://techdr.in)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  const xml = await fetchText(entry.url);
  const feed = await parser.parseString(xml);
  const now = Date.now();
  const out: RawArticle[] = [];
  for (const item of feed.items ?? []) {
    const title = (item.title ?? "").trim();
    const url = (item.link ?? "").trim();
    if (!title || !url) continue;
    const pub = item.pubDate ? new Date(item.pubDate) : new Date(now);
    if (now - pub.getTime() > WINDOW_MS) continue;
    const summary = (item.contentSnippet ?? item.content ?? item.summary ?? "").trim().slice(0, 800);
    out.push({
      title,
      url,
      sourceName: entry.name,
      summary,
      publishedAt: pub,
      authority: entry.authority,
    });
  }
  return out;
}

async function fetchNewsApi(): Promise<RawArticle[]> {
  const key = process.env.NEWS_API_KEY?.trim();
  if (!key) return [];
  const url = `https://newsapi.org/v2/top-headlines?category=health&language=en&pageSize=40&apiKey=${encodeURIComponent(key)}`;
  const res = await axios.get<{
    articles?: { title?: string | null; url?: string | null; publishedAt?: string | null; description?: string | null; source?: { name?: string | null } }[];
  }>(url, { timeout: FETCH_TIMEOUT_MS });
  const articles = res.data.articles ?? [];
  const now = Date.now();
  const out: RawArticle[] = [];
  for (const a of articles) {
    const title = (a.title ?? "").trim();
    const link = (a.url ?? "").trim();
    if (!title || !link) continue;
    const pub = a.publishedAt ? new Date(a.publishedAt) : new Date(now);
    if (now - pub.getTime() > WINDOW_MS) continue;
    const summary = (a.description ?? "").trim();
    const sourceName = (a.source?.name ?? "NewsAPI").trim() || "NewsAPI";
    out.push({
      title,
      url: link,
      sourceName,
      summary,
      publishedAt: pub,
      authority: 0.65,
    });
  }
  return out;
}

async function collectArticles(): Promise<RawArticle[]> {
  const batches = await Promise.allSettled([
    fetchNewsApi(),
    ...RSS_FEEDS.map((f) => parseRssFeed(f)),
  ]);
  const merged: RawArticle[] = [];
  for (const b of batches) {
    if (b.status === "fulfilled") merged.push(...b.value);
    else logger.warn("Trending news feed failed", { err: b.reason });
  }
  return merged;
}

async function purgeStale(): Promise<void> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  await prisma.trendingNewsItem.deleteMany({
    where: {
      fetchedAt: { lt: cutoff },
      userStates: { none: {} },
    },
  });
}

export async function maybeRefreshTrendingNews(): Promise<void> {
  const state = await prisma.trendingNewsIngestionState.findUnique({ where: { id: INGESTION_ID } });
  const last = state?.lastRunAt?.getTime() ?? 0;
  if (Date.now() - last < STALE_MS) return;

  await prisma.trendingNewsIngestionState.upsert({
    where: { id: INGESTION_ID },
    create: { id: INGESTION_ID, lastRunAt: new Date(), lastError: null },
    update: { lastRunAt: new Date(), lastError: null },
  });

  try {
    await purgeStale();
    const articles = await collectArticles();
    const clusters = clusterArticles(articles);
    const ranked = clusters
      .map((c) => {
        const { primary, sources, summary } = mergeCluster(c);
        const score = combinedScore(primary);
        const clusterId = clusterIdFromTitle(primary.title);
        return { clusterId, primary, sources, summary, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const now = new Date();

    for (const row of ranked) {
      const existing = await prisma.trendingNewsItem.findUnique({
        where: { clusterId: row.clusterId },
        include: { suggestion: true },
      });

      const newHeadline = row.primary.title.slice(0, 500);
      const headlineChanged = (existing?.primaryHeadline ?? "") !== newHeadline;
      const needsSuggestion =
        !existing?.suggestion ||
        headlineChanged ||
        existing.suggestion.complianceStatus !== "passed";

      const specialtyTags = inferSpecialtyTagsFromHeadline(row.primary.title, row.summary);
      const sourcesJson = row.sources.map((s) => ({
        name: s.name,
        url: s.url,
        publishedAt: s.publishedAt.toISOString(),
      }));

      const item = await prisma.trendingNewsItem.upsert({
        where: { clusterId: row.clusterId },
        create: {
          clusterId: row.clusterId,
          primaryHeadline: newHeadline,
          summary: row.summary.slice(0, 2000),
          specialtyTags,
          relevanceScore: row.score,
          sources: sourcesJson,
          fetchedAt: now,
        },
        update: {
          primaryHeadline: newHeadline,
          summary: row.summary.slice(0, 2000),
          specialtyTags,
          relevanceScore: row.score,
          sources: sourcesJson,
          fetchedAt: now,
        },
      });

      if (needsSuggestion) {
        if (existing?.suggestion) {
          await prisma.newsPosterSuggestion.delete({ where: { id: existing.suggestion.id } });
        }
        const gen = await generateNewsPosterSuggestionWithClaude({
          headline: row.primary.title,
          summary: row.summary,
          specialtyTags,
          sources: sourcesJson.map((s) => ({ name: s.name, url: s.url })),
        });
        await prisma.newsPosterSuggestion.create({
          data: {
            newsItemId: item.id,
            headlines: gen.headlines,
            keyTakeaway: gen.keyTakeaway,
            visualDirection: gen.visualDirection,
            recommendedSpecialtyTags: gen.recommendedSpecialtyTags,
            cta: gen.cta,
            complianceStatus: gen.complianceStatus,
            complianceFlags: gen.complianceFlags,
          },
        });
      }
    }

    await prisma.trendingNewsIngestionState.update({
      where: { id: INGESTION_ID },
      data: { lastOkAt: new Date(), lastError: null },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Trending news ingestion failed", { err });
    await prisma.trendingNewsIngestionState.update({
      where: { id: INGESTION_ID },
      data: { lastError: msg.slice(0, 2000) },
    });
  }
}
