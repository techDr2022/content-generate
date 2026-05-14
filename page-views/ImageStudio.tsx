"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  defaultPosterBrandAssetsState,
  defaultPosterImageOutputState,
  posterBrandPayloadFromState,
  type PosterBrandAssetsState,
  type PosterImageOutputState,
  type PosterLookId,
} from "@/lib/types";
import type { TrendingPosterPrefillV1 } from "@/lib/types/newsSuggestions";
import { ImageIcon, Loader2, X } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PosterBrandAssetsControls } from "@/components/calendar/PosterBrandAssetsControls";
import { PosterImageOutputControls } from "@/components/calendar/PosterImageOutputControls";
import { PosterLookControls } from "@/components/calendar/PosterLookControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGeneratePosterImage, useJobCalendarRows } from "@/hooks/useGenerator";
import { TRENDING_POSTER_PREFILL_KEY } from "@/hooks/useTrendingNewsSuggestions";
import { useJobs } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function extFromMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "png";
}

function jobLabel(job: {
  client?: { name?: string | null };
  month: number;
  year: number;
  updatedAt: string;
}): string {
  const monthName = MONTH_SHORT[job.month - 1] ?? String(job.month);
  const client = job.client?.name ?? "Client";
  return `${client} · ${monthName} ${job.year}`;
}

interface BulkOk {
  rowIndex: number;
  date: string;
  src: string;
  fileName: string;
}

interface BulkFail {
  rowIndex: number;
  date: string;
  message: string;
}

export function ImageStudioPage() {
  const searchParams = useSearchParams();
  const jobs = useJobs();
  const [jobId, setJobId] = useState<string>("");
  const [posterLook, setPosterLook] = useState<PosterLookId>("text_only");
  const [posterLookCustom, setPosterLookCustom] = useState("");
  const [imageOutput, setImageOutput] = useState<PosterImageOutputState>(() => defaultPosterImageOutputState());
  const [brandAssets, setBrandAssets] = useState<PosterBrandAssetsState>(() => defaultPosterBrandAssetsState());
  const [quickDraft, setQuickDraft] = useState<TrendingPosterPrefillV1 | null>(null);
  const [quickText, setQuickText] = useState("");
  const [quickResult, setQuickResult] = useState<{ src: string; fileName: string } | null>(null);
  const [quickRunning, setQuickRunning] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [results, setResults] = useState<BulkOk[]>([]);
  const [failures, setFailures] = useState<BulkFail[]>([]);

  const rowsQuery = useJobCalendarRows(jobId || undefined);
  const rows = rowsQuery.data ?? [];

  const generateImage = useGeneratePosterImage();

  const recentDoneJobs = useMemo(() => {
    return (jobs.data ?? [])
      .filter((j) => j.status === "done")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 80);
  }, [jobs.data]);

  useEffect(() => {
    if (searchParams.get("prefill") !== "1") return;
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(TRENDING_POSTER_PREFILL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as TrendingPosterPrefillV1;
      if (parsed?.v === 1 && typeof parsed.textInImage === "string" && parsed.textInImage.trim()) {
        setQuickDraft(parsed);
        setQuickText(parsed.textInImage);
        setPosterLook(parsed.posterLook);
        setPosterLookCustom(parsed.posterLookCustom ?? "");
        setQuickResult(null);
      }
    } catch {
      // ignore malformed payloads
    }
    window.sessionStorage.removeItem(TRENDING_POSTER_PREFILL_KEY);
    window.history.replaceState({}, "", "/poster-images");
  }, [searchParams]);

  useEffect(() => {
    setSelected(new Set());
    setResults([]);
    setFailures([]);
    setBulkDone(0);
    setBulkTotal(0);
  }, [jobId]);

  const posterGenerateBlocked = posterLook === "custom" && posterLookCustom.trim().length === 0;

  const toggleRow = useCallback((index: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const selectWithText = useMemo(() => {
    const idx: number[] = [];
    rows.forEach((r, i) => {
      if (r.textInImage?.trim()) idx.push(i);
    });
    return idx;
  }, [rows]);

  const selectedIndices = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);

  const selectedRunnable = useMemo(
    () => selectedIndices.filter((i) => rows[i]?.textInImage?.trim()),
    [selectedIndices, rows]
  );

  async function runBulkGenerate(): Promise<void> {
    if (selectedRunnable.length === 0 || posterGenerateBlocked) return;
    setBulkRunning(true);
    setResults([]);
    setFailures([]);
    setBulkTotal(selectedRunnable.length);
    setBulkDone(0);

    const ok: BulkOk[] = [];
    const bad: BulkFail[] = [];

    for (let step = 0; step < selectedRunnable.length; step++) {
      const rowIndex = selectedRunnable[step]!;
      const post = rows[rowIndex];
      const text = post?.textInImage?.trim();
      if (!text) {
        bad.push({
          rowIndex,
          date: post?.date ?? "—",
          message: "Empty Text in image",
        });
        setBulkDone(step + 1);
        continue;
      }

      try {
        const data = await generateImage.mutateAsync({
          textInImage: text,
          posterLook,
          posterLookCustom: posterLook === "custom" ? posterLookCustom.trim() : undefined,
          ...imageOutput,
          ...posterBrandPayloadFromState(brandAssets),
        });
        const safeDate = (post.date ?? `row-${rowIndex}`).replace(/[^\w\-]+/g, "_");
        ok.push({
          rowIndex,
          date: post.date,
          src: `data:${data.mimeType};base64,${data.imageBase64}`,
          fileName: `poster-${safeDate}.${extFromMime(data.mimeType)}`,
        });
      } catch (e) {
        bad.push({
          rowIndex,
          date: post.date,
          message: e instanceof Error ? e.message : String(e),
        });
      }

      setBulkDone(step + 1);
      await new Promise((r) => setTimeout(r, 350));
    }

    setResults(ok);
    setFailures(bad);
    setBulkRunning(false);
  }

  const previewErrorMsg = rowsQuery.error instanceof Error ? rowsQuery.error.message : "";
  const previewNeedsLocalHint =
    previewErrorMsg.includes("LOCAL") || previewErrorMsg.includes("Preview is only");

  async function runQuickGenerate(): Promise<void> {
    const text = quickText.trim();
    if (!text || posterGenerateBlocked) return;
    setQuickRunning(true);
    setQuickResult(null);
    try {
      const data = await generateImage.mutateAsync({
        textInImage: text,
        posterLook,
        posterLookCustom: posterLook === "custom" ? posterLookCustom.trim() : undefined,
        ...imageOutput,
        ...posterBrandPayloadFromState(brandAssets),
      });
      setQuickResult({
        src: `data:${data.mimeType};base64,${data.imageBase64}`,
        fileName: `poster-trending.${extFromMime(data.mimeType)}`,
      });
    } finally {
      setQuickRunning(false);
    }
  }

  return (
    <PageWrapper
      title="Poster images"
      description="Load recent completed calendars, pick rows, and generate healthcare posters in bulk from Text in image."
      className="max-w-7xl"
    >
      {quickDraft ? (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Trending news draft</CardTitle>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{quickDraft.headline}</span> · CTA:{" "}
                <span className="font-medium text-foreground">{quickDraft.cta}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickDraft.sourceUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={quickDraft.sourceUrl} target="_blank" rel="noreferrer">
                    Open source
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setQuickDraft(null);
                  setQuickText("");
                  setQuickResult(null);
                }}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-text">Text in image</Label>
              <Textarea
                id="quick-text"
                rows={8}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4">
                <PosterLookControls
                  posterLook={posterLook}
                  onPosterLookChange={setPosterLook}
                  posterLookCustom={posterLookCustom}
                  onPosterLookCustomChange={setPosterLookCustom}
                />
                <PosterBrandAssetsControls
                  value={brandAssets}
                  onChange={(patch) => setBrandAssets((prev) => ({ ...prev, ...patch }))}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Customize image output</p>
                <PosterImageOutputControls
                  value={imageOutput}
                  onChange={(patch) => setImageOutput((prev) => ({ ...prev, ...patch }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                className="gap-2"
                disabled={!quickText.trim() || posterGenerateBlocked || quickRunning}
                onClick={() => void runQuickGenerate()}
              >
                {quickRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageIcon className="h-4 w-4" aria-hidden />}
                Generate poster
              </Button>
              {posterGenerateBlocked ? (
                <p className="text-xs text-destructive">Add custom instructions or choose another poster look.</p>
              ) : null}
            </div>
            {quickResult ? (
              <figure className="space-y-2 rounded-lg border bg-white p-3 shadow-sm">
                <figcaption className="text-xs font-medium text-foreground">Preview</figcaption>
                <img src={quickResult.src} alt="Generated poster" className="w-full max-w-md rounded-md border object-contain" />
                <Button variant="secondary" size="sm" className="w-full max-w-md" asChild>
                  <a href={quickResult.src} download={quickResult.fileName}>
                    Download
                  </a>
                </Button>
              </figure>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent calendar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Chooses the latest completed generator jobs. Preview requires{" "}
            <span className="font-medium text-foreground">local workbook storage</span> on the server (same as Generator
            preview).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studio-job">Completed job</Label>
            <Select
              value={jobId || undefined}
              onValueChange={(v) => setJobId(v)}
              disabled={recentDoneJobs.length === 0}
            >
              <SelectTrigger id="studio-job" className="max-w-xl">
                <SelectValue placeholder={recentDoneJobs.length ? "Select a job…" : "No completed jobs yet"} />
              </SelectTrigger>
              <SelectContent>
                {recentDoneJobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {jobLabel(j)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {jobId && rowsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading rows…
            </div>
          ) : null}

          {jobId && rowsQuery.isError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Could not load calendar"}
              {previewNeedsLocalHint
                ? " — Calendar preview needs STORAGE_TYPE=LOCAL on the API so workbooks stay on disk."
                : null}
            </p>
          ) : null}

          {jobId && rows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4">
                <PosterLookControls
                  posterLook={posterLook}
                  onPosterLookChange={setPosterLook}
                  posterLookCustom={posterLookCustom}
                  onPosterLookCustomChange={setPosterLookCustom}
                />
                <PosterBrandAssetsControls
                  value={brandAssets}
                  onChange={(patch) => setBrandAssets((prev) => ({ ...prev, ...patch }))}
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Customize image output</p>
                <PosterImageOutputControls
                  value={imageOutput}
                  onChange={(patch) => setImageOutput((prev) => ({ ...prev, ...patch }))}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {jobId && rows.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Select rows</CardTitle>
              <p className="text-sm text-muted-foreground">
                {rows.length} row(s) · {selectWithText.length} with Text in image · {selected.size} selected
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set(selectWithText))}
                disabled={bulkRunning || selectWithText.length === 0}
              >
                Select all with text
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(new Set(rows.map((_, i) => i)))
                }
                disabled={bulkRunning}
              >
                Select all rows
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={bulkRunning}>
                Clear selection
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Date</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead className="min-w-[240px]">Text in image</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const hasText = Boolean(row.textInImage?.trim());
                    return (
                      <TableRow key={`${row.date}-${index}`}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(index)}
                            onCheckedChange={(v) => toggleRow(index, v === true)}
                            disabled={bulkRunning}
                            aria-label={`Select row ${row.date}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-medium">{row.date}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.style}</TableCell>
                        <TableCell className="max-w-xl text-xs text-muted-foreground">
                          <span className={cn(!hasText && "italic text-destructive/80")}>
                            {hasText ? row.textInImage : "No text in image"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                className="gap-2"
                disabled={bulkRunning || selectedRunnable.length === 0 || posterGenerateBlocked}
                onClick={() => void runBulkGenerate()}
              >
                {bulkRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden />
                )}
                {bulkRunning ? `Generating ${bulkDone} / ${bulkTotal}…` : `Generate selected (${selectedRunnable.length})`}
              </Button>
              {posterGenerateBlocked ? (
                <p className="text-xs text-destructive">Add custom instructions or choose another poster look.</p>
              ) : null}
            </div>

            {bulkRunning || (bulkTotal > 0 && !bulkRunning) ? (
              <div className="space-y-2">
                <Progress value={bulkTotal ? Math.round((bulkDone / bulkTotal) * 100) : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Images are requested one at a time to reduce API rate limits (~15–45s each).
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {(results.length > 0 || failures.length > 0) && !bulkRunning ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated posters</CardTitle>
            <p className="text-sm text-muted-foreground">
              {results.length} succeeded
              {failures.length ? ` · ${failures.length} failed` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {failures.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <p className="font-medium text-destructive">Failed rows</p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {failures.map((f) => (
                    <li key={`${f.rowIndex}-${f.date}`}>
                      {f.date}: {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((r) => (
                  <figure key={`${r.rowIndex}-${r.date}`} className="space-y-2 rounded-lg border bg-white p-3 shadow-sm">
                    <figcaption className="text-xs font-medium text-foreground">{r.date}</figcaption>
                    <img
                      src={r.src}
                      alt={`Poster ${r.date}`}
                      className="w-full rounded-md border object-contain"
                    />
                    <Button variant="secondary" size="sm" className="w-full" asChild>
                      <a href={r.src} download={r.fileName}>
                        Download PNG
                      </a>
                    </Button>
                  </figure>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </PageWrapper>
  );
}