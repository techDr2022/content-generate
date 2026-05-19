"use client";

import type { CalendarPost } from "@/lib/types";
import type { RowPosterLook } from "@/lib/posterRowLooks";
import { isRowPosterLookBlocked } from "@/lib/posterRowLooks";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { posterRowKey } from "@/hooks/usePosterImageFlow";
import { PosterLookSelect } from "./PosterLookSelect";

function truncateText(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export interface PosterBulkResult {
  rowIndex: number;
  date: string;
  src: string;
  mimeType: string;
  fileName: string;
}

interface PosterImagesActionsCardProps {
  rows: CalendarPost[];
  rowLooks: Record<number, RowPosterLook>;
  selected: Set<number>;
  onToggleRowSelected: (rowIndex: number, checked: boolean) => void;
  onSelectAllRows: () => void;
  onClearSelection: () => void;
  selectedRunnableCount: number;
  onRowLookChange: (rowIndex: number, look: RowPosterLook) => void;
  onGeneratePoster: (post: CalendarPost, rowIndex: number) => void;
  onGenerateSelected: () => void;
  posterLoadingKey: string | null;
  posterPending: boolean;
  bulkRunning: boolean;
  bulkDone: number;
  bulkTotal: number;
  bulkResults: PosterBulkResult[];
}

export function PosterImagesActionsCard({
  rows,
  rowLooks,
  selected,
  onToggleRowSelected,
  onSelectAllRows,
  onClearSelection,
  selectedRunnableCount,
  onRowLookChange,
  onGeneratePoster,
  onGenerateSelected,
  posterLoadingKey,
  posterPending,
  bulkRunning,
  bulkDone,
  bulkTotal,
  bulkResults,
}: PosterImagesActionsCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200/90 shadow-sm dark:border-slate-800">
      <CardHeader className="space-y-3 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg leading-tight sm:text-xl">Poster images</CardTitle>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
              Choose a <span className="font-medium text-foreground">poster look per row</span>, select the rows you
              want, then <span className="font-medium text-foreground">generate selected</span> or one at a time.
            </p>
          </div>
          <Button
            type="button"
            className="h-10 shrink-0 gap-2 sm:h-9"
            disabled={bulkRunning || selectedRunnableCount === 0 || posterPending}
            onClick={() => void onGenerateSelected()}
          >
            {bulkRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImageIcon className="h-4 w-4" aria-hidden />
            )}
            {bulkRunning
              ? `Generating ${bulkDone} / ${bulkTotal}…`
              : `Generate selected (${selectedRunnableCount})`}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSelectAllRows}
            disabled={bulkRunning || rows.length === 0}
          >
            Select all rows
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={bulkRunning || selected.size === 0}
          >
            Clear selection
          </Button>
        </div>
        {bulkRunning || bulkTotal > 0 ? (
          <Progress value={bulkTotal ? Math.round((bulkDone / bulkTotal) * 100) : 0} className="h-2" />
        ) : null}
      </CardHeader>
      <CardContent className="max-h-[min(52dvh,480px)] space-y-2 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-0 [-webkit-overflow-scrolling:touch] sm:max-h-[min(56dvh,520px)] sm:px-6 sm:pb-6">
        {rows.map((row, index) => {
          const key = posterRowKey(row, index);
          const text = row.textInImage?.trim();
          const look = rowLooks[index] ?? { posterLook: "text_only", posterLookCustom: "" };
          const blocked = isRowPosterLookBlocked(look);
          const busy = (posterPending && posterLoadingKey === key) || bulkRunning;
          const disabled = !text || busy || blocked;
          const isSelected = selected.has(index);

          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-card p-3.5 dark:border-slate-800"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(v) => onToggleRowSelected(index, v === true)}
                  disabled={bulkRunning}
                  className="mt-0.5"
                  aria-label={`Select ${row.date} for bulk generation`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-medium text-foreground">{row.date}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {text ? truncateText(text, 220) : <span className="italic">No text in image</span>}
                  </p>
                </div>
              </div>
              <PosterLookSelect
                compact
                idPrefix={`row-${index}-look`}
                value={look}
                onChange={(next) => onRowLookChange(index, next)}
              />
              {blocked ? (
                <p className="text-xs text-destructive">Add custom instructions for this row.</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 w-full gap-2 sm:w-auto"
                disabled={disabled}
                onClick={() => void onGeneratePoster(row, index)}
                aria-label={`Generate poster image for ${row.date}`}
              >
                {busy && posterLoadingKey === key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                )}
                {busy && posterLoadingKey === key ? "Generating…" : "Generate image"}
              </Button>
            </div>
          );
        })}
      </CardContent>

      {bulkResults.length > 0 && !bulkRunning ? (
        <div className="border-t border-slate-200/80 px-4 py-4 sm:px-6 dark:border-slate-800">
          <p className="mb-3 text-sm font-medium">Generated ({bulkResults.length})</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bulkResults.map((r) => (
              <figure key={`${r.rowIndex}-${r.date}`} className="space-y-2 rounded-lg border bg-white p-2 shadow-sm">
                <figcaption className="text-xs font-medium">{r.date}</figcaption>
                <img src={r.src} alt={`Poster ${r.date}`} className="w-full rounded border object-contain" />
                <Button variant="secondary" size="sm" className="w-full" asChild>
                  <a href={r.src} download={r.fileName}>
                    Download
                  </a>
                </Button>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
