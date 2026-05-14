"use client";

import { useMemo, useState } from "react";
import { Bookmark, ChevronDown, ChevronUp, ExternalLink, ImageIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { TrendingNewsCardDTO } from "@/lib/types/newsSuggestions";
import {
  useDismissNewsSuggestion,
  usePosterPrefillFromSuggestion,
  useSaveNewsSuggestion,
  useTrendingNewsSuggestions,
} from "@/hooks/useTrendingNewsSuggestions";

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function faviconUrl(url: string): string {
  const host = hostFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function relativeTimeLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "recently";
  const hrs = Math.floor(diffMs / (60 * 60 * 1000));
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function newestSource(card: TrendingNewsCardDTO): { name: string; url: string; publishedAt: string } | null {
  const s = card.news.sources;
  if (!s.length) return null;
  return [...s].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0] ?? null;
}

export function TrendingHealthcareNewsPanel() {
  const q = useTrendingNewsSuggestions(undefined, 8);
  const save = useSaveNewsSuggestion();
  const dismiss = useDismissNewsSuggestion();
  const prefill = usePosterPrefillFromSuggestion();
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const rows = q.data ?? [];
    return expanded ? rows : rows.slice(0, 5);
  }, [q.data, expanded]);

  return (
    <Card className="border-primary/15">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-lg">Trending Healthcare News</CardTitle>
          <p className="text-sm text-muted-foreground">
            Breaking medical stories in the last 72 hours with poster concepts you can open in Poster images.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => setExpanded((v) => !v)}
          disabled={(q.data?.length ?? 0) <= 5}
        >
          {expanded ? (
            <>
              Show fewer <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              See more <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading trending stories…</p> : null}
        {q.isError ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load news."}</p>
        ) : null}

        {visible.map((card) => {
          const top = newestSource(card);
          const when = top ? relativeTimeLabel(top.publishedAt) : "recently";
          const sug = card.suggestion;

          return (
            <div key={card.news.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {top ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external favicon helper URL
                      <img
                        src={faviconUrl(top.url)}
                        alt=""
                        className="h-6 w-6 rounded-sm border bg-white p-0.5"
                        loading="lazy"
                      />
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {top?.name ?? "Sources"} · {when}
                    </p>
                  </div>
                  <h3 className="text-base font-semibold leading-snug text-foreground">{card.news.primaryHeadline}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {card.news.specialtyTags.slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] font-medium">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col">
                  {top ? (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <a href={top.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        View source
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    disabled={save.isPending}
                    onClick={() => void save.mutateAsync(card.news.id)}
                  >
                    <Bookmark className="h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    disabled={dismiss.isPending}
                    onClick={() => void dismiss.mutateAsync(card.news.id)}
                  >
                    <X className="h-4 w-4" />
                    Dismiss
                  </Button>
                </div>
              </div>

              {sug ? (
                <>
                  <Separator className="my-4" />
                  <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Poster concept previews
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {sug.headlines.slice(0, 3).map((h, idx) => (
                          <div
                            key={`${card.news.id}-h-${idx}`}
                            className="flex min-h-[92px] flex-col justify-between rounded-md border bg-muted/30 p-2 text-left"
                          >
                            <p className="line-clamp-4 text-[11px] font-semibold leading-snug text-foreground">{h}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-8 text-[11px]"
                              disabled={prefill.isPending}
                              onClick={() => void prefill.mutateAsync({ suggestionId: sug.id, variantIndex: idx })}
                            >
                              <ImageIcon className="mr-1 h-3.5 w-3.5" />
                              Generate
                            </Button>
                          </div>
                        ))}
                      </div>
                      <details className="rounded-md border bg-muted/20 px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">Why this matters</summary>
                        <p className="mt-2 text-sm text-muted-foreground">{sug.keyTakeaway}</p>
                      </details>
                      <p className="text-[11px] text-muted-foreground">
                        Suggested look:{" "}
                        <span className="font-medium text-foreground">{sug.visualDirection.mood}</span> · CTA:{" "}
                        <span className="font-medium text-foreground">{sug.cta}</span>
                        {sug.complianceStatus !== "passed" ? (
                          <span className={cn("ml-2 rounded-sm border px-1.5 py-0.5", "border-amber-300 bg-amber-50")}>
                            Compliance: {sug.complianceStatus}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/10 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">Palette</p>
                      <p className="mt-1">{sug.visualDirection.palette.join(" · ")}</p>
                      <p className="mt-3 font-semibold text-foreground">Icon hints</p>
                      <p className="mt-1">{sug.visualDirection.iconHints.join(" · ")}</p>
                      <p className="mt-3 font-semibold text-foreground">Client targeting</p>
                      <p className="mt-1">{sug.recommendedSpecialtyTags.join(" · ")}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Poster concepts are generating for this story…</p>
              )}
            </div>
          );
        })}

        {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stories yet. Ingestion runs every 6 hours; add <span className="font-mono">NEWS_API_KEY</span> for NewsAPI
            health headlines alongside RSS sources.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
