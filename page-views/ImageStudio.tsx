"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultPosterBrandAssetsState,
  defaultPosterImageOutputState,
  posterBrandPayloadFromState,
  type PosterBrandAssetsState,
  type PosterImageOutputState,
  type PosterLookId,
} from "@/lib/types";
import { ImageIcon, Loader2 } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { PosterBrandAssetsControls } from "@/components/calendar/PosterBrandAssetsControls";
import { PosterImageOutputControls } from "@/components/calendar/PosterImageOutputControls";
import { PosterLookControls } from "@/components/calendar/PosterLookControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useGeneratePosterImage, useJobCalendarRows } from "@/hooks/useGenerator";
import { useJobs } from "@/hooks/useJobs";
import { parseCustomPosterTexts } from "@/lib/posterCustomText";
import { cn } from "@/lib/utils";

type StudioMode = "calendar" | "custom";

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

function customPosterLabel(text: string, index: number): string {
  const firstLine = text.split(/\n/)[0]?.trim() ?? "";
  if (firstLine.length > 48) return `Poster ${index + 1}: ${firstLine.slice(0, 45)}…`;
  return firstLine ? `Poster ${index + 1}: ${firstLine}` : `Poster ${index + 1}`;
}

export function ImageStudioPage() {
  const jobs = useJobs();
  const [studioMode, setStudioMode] = useState<StudioMode>("custom");
  const [customTextBulk, setCustomTextBulk] = useState("");
  const [jobId, setJobId] = useState<string>("");
  const [posterLook, setPosterLook] = useState<PosterLookId>("text_only");
  const [posterLookCustom, setPosterLookCustom] = useState("");
  const [imageOutput, setImageOutput] = useState<PosterImageOutputState>(() => defaultPosterImageOutputState());
  const [brandAssets, setBrandAssets] = useState<PosterBrandAssetsState>(() => defaultPosterBrandAssetsState());
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

  const customTexts = useMemo(() => parseCustomPosterTexts(customTextBulk), [customTextBulk]);

  const showPosterSettings = studioMode === "custom" || (jobId.length > 0 && rows.length > 0);

  async function runBulkForItems(
    items: { rowIndex: number; text: string; label: string; fileSlug: string }[]
  ): Promise<void> {
    if (items.length === 0 || posterGenerateBlocked) return;
    setBulkRunning(true);
    setResults([]);
    setFailures([]);
    setBulkTotal(items.length);
    setBulkDone(0);

    const ok: BulkOk[] = [];
    const bad: BulkFail[] = [];

    for (let step = 0; step < items.length; step++) {
      const { rowIndex, text, label, fileSlug } = items[step]!;

      try {
        const data = await generateImage.mutateAsync({
          textInImage: text,
          posterLook,
          posterLookCustom: posterLook === "custom" ? posterLookCustom.trim() : undefined,
          ...imageOutput,
          ...posterBrandPayloadFromState(brandAssets),
        });
        const safeSlug = fileSlug.replace(/[^\w\-]+/g, "_");
        ok.push({
          rowIndex,
          date: label,
          src: `data:${data.mimeType};base64,${data.imageBase64}`,
          fileName: `poster-${safeSlug}.${extFromMime(data.mimeType)}`,
        });
      } catch (e) {
        bad.push({
          rowIndex,
          date: label,
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

  async function runBulkGenerate(): Promise<void> {
    const items = selectedRunnable
      .map((rowIndex) => {
        const post = rows[rowIndex];
        const text = post?.textInImage?.trim();
        if (!text) return null;
        return {
          rowIndex,
          text,
          label: post?.date ?? "—",
          fileSlug: post?.date ?? `row-${rowIndex}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    await runBulkForItems(items);
  }

  async function runCustomBulkGenerate(): Promise<void> {
    const items = customTexts.map((text, index) => ({
      rowIndex: index,
      text,
      label: customPosterLabel(text, index),
      fileSlug: `custom-${index + 1}`,
    }));
    await runBulkForItems(items);
  }

  const previewErrorMsg = rowsQuery.error instanceof Error ? rowsQuery.error.message : "";
  const previewNeedsLocalHint =
    previewErrorMsg.includes("LOCAL") || previewErrorMsg.includes("Preview is only");

  const customGenerateLabel =
    customTexts.length === 0
      ? "Generate posters"
      : `Generate ${customTexts.length} poster${customTexts.length === 1 ? "" : "s"}`;

  return (
    <PageWrapper
      title="Poster images"
      description="Create your own posters in bulk with custom text, or generate from a completed calendar job."
      className="max-w-7xl"
    >
      {showPosterSettings ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Poster settings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Look, brand assets, and output options apply to calendar rows and custom text alike.
            </p>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                {studioMode === "custom" ? "Bulk poster text" : "Calendar source"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {studioMode === "calendar"
                  ? "Load a completed generator job and pick rows."
                  : "Paste one or more posters below, then generate them all at once. No calendar job needed."}
              </p>
            </div>
            <div className="flex shrink-0 rounded-lg border p-0.5" role="group" aria-label="Poster source">
              <Button
                type="button"
                size="sm"
                variant={studioMode === "custom" ? "default" : "ghost"}
                className="rounded-md"
                disabled={bulkRunning}
                onClick={() => setStudioMode("custom")}
              >
                My posters (bulk)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={studioMode === "calendar" ? "default" : "ghost"}
                className="rounded-md"
                disabled={bulkRunning}
                onClick={() => setStudioMode("calendar")}
              >
                From calendar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {studioMode === "calendar" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Chooses the latest completed generator jobs. Preview requires{" "}
                <span className="font-medium text-foreground">local workbook storage</span> on the server (same as
                Generator preview).
              </p>
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studio-custom-text">Poster text</Label>
                <Textarea
                  id="studio-custom-text"
                  value={customTextBulk}
                  onChange={(e) => setCustomTextBulk(e.target.value)}
                  disabled={bulkRunning}
                  placeholder={`Heart health matters.\n\nBook an appointment\nSunrise Clinic\nAustin\n\n---\n\nSecond poster headline…`}
                  className="min-h-[200px] font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  Use line breaks for multi-line posters. For multiple posters, put a line with only{" "}
                  <span className="font-medium text-foreground">---</span> between each block.
                  {customTexts.length > 0 ? ` ${customTexts.length} poster(s) ready to generate.` : ""}
                </p>
              </div>

              {customTexts.length > 0 ? (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-foreground">Preview ({customTexts.length})</p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {customTexts.map((text, index) => (
                      <li
                        key={index}
                        className="rounded border bg-background px-2.5 py-2 text-xs text-muted-foreground whitespace-pre-wrap"
                      >
                        <span className="font-medium text-foreground">Poster {index + 1}</span>
                        <span className="mx-1">·</span>
                        {text.length > 160 ? `${text.slice(0, 157)}…` : text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  className="gap-2"
                  disabled={bulkRunning || customTexts.length === 0 || posterGenerateBlocked}
                  onClick={() => void runCustomBulkGenerate()}
                >
                  {bulkRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImageIcon className="h-4 w-4" aria-hidden />
                  )}
                  {bulkRunning ? `Generating ${bulkDone} / ${bulkTotal}…` : customGenerateLabel}
                </Button>
                {posterGenerateBlocked ? (
                  <p className="text-xs text-destructive">Add custom instructions or choose another poster look.</p>
                ) : null}
              </div>
              {bulkRunning || bulkTotal > 0 ? (
                <div className="space-y-2">
                  <Progress value={bulkTotal ? Math.round((bulkDone / bulkTotal) * 100) : 0} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Images are requested one at a time to reduce API rate limits (~15–45s each).
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {studioMode === "calendar" && jobId && rows.length > 0 ? (
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
                onClick={() => setSelected(new Set(rows.map((_, i) => i)))}
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

            {bulkRunning || bulkTotal > 0 ? (
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
