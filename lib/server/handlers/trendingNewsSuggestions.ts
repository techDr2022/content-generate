import { z } from "zod";
import { HttpError } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { maybeRefreshTrendingNews } from "@/lib/server/services/trendingNewsIngestion";
import {
  buildPosterLookCustomFromVisual,
  moodToPosterLook,
} from "@/lib/server/services/newsSuggestionCompliance";
import type {
  NewsSourceRef,
  PosterSuggestionDTO,
  TrendingNewsCardDTO,
  TrendingPosterPrefillV1,
  VisualMood,
} from "@/lib/types/newsSuggestions";

const WINDOW_MS = 72 * 60 * 60 * 1000;

function mapSources(raw: unknown): NewsSourceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : "";
      const url = typeof o.url === "string" ? o.url : "";
      const publishedAt = typeof o.publishedAt === "string" ? o.publishedAt : new Date().toISOString();
      if (!name || !url) return null;
      return { name, url, publishedAt };
    })
    .filter((x): x is NewsSourceRef => Boolean(x));
}

function mapVisualDirection(raw: unknown): PosterSuggestionDTO["visualDirection"] {
  if (!raw || typeof raw !== "object") {
    return { palette: ["soft blue", "warm white"], mood: "educational", iconHints: ["stethoscope outline"] };
  }
  const o = raw as Record<string, unknown>;
  const palette = Array.isArray(o.palette) ? o.palette.filter((p): p is string => typeof p === "string") : [];
  const iconHints = Array.isArray(o.iconHints) ? o.iconHints.filter((p): p is string => typeof p === "string") : [];
  const moodRaw = typeof o.mood === "string" ? o.mood : "educational";
  const mood: VisualMood =
    moodRaw === "clinical" || moodRaw === "warm" || moodRaw === "urgent" || moodRaw === "educational"
      ? moodRaw
      : "educational";
  return {
    palette: palette.length ? palette : ["soft blue", "warm white"],
    mood,
    iconHints: iconHints.length ? iconHints : ["stethoscope outline"],
  };
}

export async function listDashboardNewsSuggestions(userId: string, searchParams: URLSearchParams) {
  await maybeRefreshTrendingNews();

  const specialty = searchParams.get("specialty")?.trim() ?? "";
  const limit = Math.min(20, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "5", 10) || 5));
  const minFetched = new Date(Date.now() - WINDOW_MS);

  const rows = await prisma.trendingNewsItem.findMany({
    where: {
      fetchedAt: { gte: minFetched },
      ...(specialty ? { specialtyTags: { has: specialty } } : {}),
      NOT: {
        userStates: {
          some: { userId, dismissed: true },
        },
      },
    },
    include: {
      suggestion: true,
      userStates: { where: { userId } },
    },
    orderBy: [{ relevanceScore: "desc" }, { fetchedAt: "desc" }],
    take: limit,
  });

  const data: TrendingNewsCardDTO[] = rows.map((r) => {
    const st = r.userStates[0];
    const suggestion: PosterSuggestionDTO | null = r.suggestion
      ? {
          id: r.suggestion.id,
          newsItemId: r.id,
          headlines: r.suggestion.headlines,
          keyTakeaway: r.suggestion.keyTakeaway,
          visualDirection: mapVisualDirection(r.suggestion.visualDirection),
          recommendedSpecialtyTags: r.suggestion.recommendedSpecialtyTags,
          cta: r.suggestion.cta,
          complianceStatus: r.suggestion.complianceStatus as PosterSuggestionDTO["complianceStatus"],
          complianceFlags: r.suggestion.complianceFlags,
        }
      : null;

    return {
      news: {
        id: r.id,
        clusterId: r.clusterId,
        sources: mapSources(r.sources),
        primaryHeadline: r.primaryHeadline,
        summary: r.summary,
        specialtyTags: r.specialtyTags,
        relevanceScore: r.relevanceScore,
        fetchedAt: r.fetchedAt.toISOString(),
      },
      suggestion,
      user: { saved: Boolean(st?.saved), dismissed: Boolean(st?.dismissed) },
    };
  });

  return { success: true as const, data };
}

export async function saveNewsSuggestion(userId: string, newsItemId: string) {
  await prisma.userTrendingNewsState.upsert({
    where: { userId_newsItemId: { userId, newsItemId } },
    create: { userId, newsItemId, saved: true, dismissed: false },
    update: { saved: true, dismissed: false },
  });
  return { success: true as const, data: { id: newsItemId, saved: true } };
}

export async function dismissNewsSuggestion(userId: string, newsItemId: string) {
  await prisma.userTrendingNewsState.upsert({
    where: { userId_newsItemId: { userId, newsItemId } },
    create: { userId, newsItemId, saved: false, dismissed: true },
    update: { dismissed: true },
  });
  return { success: true as const, data: { id: newsItemId, dismissed: true } };
}

const fromBody = z.object({
  variantIndex: z.number().int().min(0).max(2).optional(),
});

export async function buildPosterPrefillFromSuggestion(
  _userId: string,
  suggestionId: string,
  body: unknown
): Promise<TrendingPosterPrefillV1> {
  const parsed = fromBody.safeParse(body ?? {});
  const variantIndex = parsed.success ? (parsed.data.variantIndex ?? 0) : 0;

  const suggestion = await prisma.newsPosterSuggestion.findUnique({
    where: { id: suggestionId },
    include: { newsItem: true },
  });

  if (!suggestion) {
    throw new HttpError(404, "Suggestion not found");
  }

  const headline = suggestion.headlines[variantIndex] ?? suggestion.headlines[0] ?? suggestion.newsItem.primaryHeadline;
  const vd = mapVisualDirection(suggestion.visualDirection);
  const posterLook = moodToPosterLook(vd.mood);
  const posterLookCustom = buildPosterLookCustomFromVisual({ palette: vd.palette, iconHints: vd.iconHints });
  const primaryUrl = mapSources(suggestion.newsItem.sources)[0]?.url;

  const textInImage = [headline, "", suggestion.keyTakeaway, "", suggestion.cta].join("\n").slice(0, 12_000);

  return {
    v: 1,
    textInImage,
    posterLook,
    posterLookCustom: posterLook === "text_only" ? undefined : posterLookCustom,
    headline,
    keyTakeaway: suggestion.keyTakeaway,
    cta: suggestion.cta,
    sourceUrl: primaryUrl,
    variantIndex,
  };
}
