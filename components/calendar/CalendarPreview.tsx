import { useState } from "react";
import {
  defaultPosterBrandAssetsState,
  defaultPosterImageOutputState,
  type CalendarPost,
  type PosterBrandAssetsState,
  type PosterImageOutputState,
  type PosterLookId,
} from "@/lib/types";
import { ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyCalendarPostsForSheets } from "@/lib/calendarSheetExport";
import { CalendarTable } from "./CalendarTable";
import { PosterImageDialog } from "./PosterImageDialog";
import { PosterImagesActionsCard } from "./PosterImagesActionsCard";
import { usePosterImageFlow } from "@/hooks/usePosterImageFlow";
import { PosterBrandAssetsControls } from "./PosterBrandAssetsControls";
import { PosterImageOutputControls } from "./PosterImageOutputControls";
import { PosterLookControls } from "./PosterLookControls";
import { cn } from "@/lib/utils";

interface CalendarPreviewProps {
  rows: CalendarPost[];
}

export function CalendarPreview({ rows }: CalendarPreviewProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [posterLook, setPosterLook] = useState<PosterLookId>("text_only");
  const [posterLookCustom, setPosterLookCustom] = useState("");
  const [imageOutput, setImageOutput] = useState<PosterImageOutputState>(() => defaultPosterImageOutputState());
  const [brandAssets, setBrandAssets] = useState<PosterBrandAssetsState>(() => defaultPosterBrandAssetsState());
  const poster = usePosterImageFlow({ posterLook, posterLookCustom, imageOutput, brandAssets });
  const posterGenerateBlocked = posterLook === "custom" && posterLookCustom.trim().length === 0;

  async function handleCopySheet(): Promise<void> {
    try {
      await copyCalendarPostsForSheets(rows);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 3500);
    }
  }

  const posterSettings = (
    <div className="grid gap-5 sm:gap-6 md:grid-cols-2 md:items-start">
      <div className="min-w-0 space-y-4">
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
      <div className="min-w-0 space-y-3">
        <p className="text-sm font-medium text-foreground">Customize image output</p>
        <PosterImageOutputControls
          value={imageOutput}
          onChange={(patch) => setImageOutput((prev) => ({ ...prev, ...patch }))}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="overflow-hidden border-slate-200/90 shadow-md dark:border-slate-800">
        <CardHeader className="space-y-3 px-4 pb-4 pt-5 sm:px-6 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg leading-tight sm:text-xl">Calendar preview</CardTitle>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                Workbook rows for QA. Scroll horizontally on small screens. Use poster settings below, then generate
                images from the table or the quick list.
              </p>
            </div>
            {rows.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full shrink-0 gap-2 sm:h-9 sm:w-auto"
                onClick={() => void handleCopySheet()}
                aria-label="Copy entire calendar as tab-separated text for Google Sheets"
              >
                <Copy className="h-4 w-4 shrink-0" />
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                    ? "Copy failed — retry"
                    : "Copy for Sheets"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {rows.length > 0 ? (
          <details className="calendar-preview-details group border-t border-slate-200/80 bg-muted/20 dark:border-slate-800">
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-foreground sm:px-6 lg:hidden",
                "[&::-webkit-details-marker]:hidden"
              )}
            >
              <span>Poster & image settings</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200/60 px-4 pb-5 pt-3 sm:px-6 lg:pt-5">
              {posterSettings}
            </div>
          </details>
        ) : null}
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">No preview rows yet.</p>
          ) : (
            <CalendarTable
              rows={rows}
              onGeneratePoster={poster.generateFromPost}
              posterLoadingKey={poster.loadingKey}
              posterPending={poster.isPending}
              posterGenerateBlocked={posterGenerateBlocked}
            />
          )}
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <PosterImagesActionsCard
          rows={rows}
          onGeneratePoster={poster.generateFromPost}
          posterLoadingKey={poster.loadingKey}
          posterPending={poster.isPending}
          posterGenerateBlocked={posterGenerateBlocked}
        />
      ) : null}

      <PosterImageDialog
        open={poster.previewOpen}
        onOpenChange={poster.onDialogOpenChange}
        previewSrc={poster.previewSrc}
        previewMeta={poster.previewMeta}
        dialogError={poster.dialogError}
        showLoading={poster.showLoading}
      />
    </div>
  );
}
