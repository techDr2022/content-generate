import { useState } from "react";
import type { CalendarPost, PosterLookId } from "@/lib/types";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyCalendarPostsForSheets } from "@/lib/calendarSheetExport";
import { CalendarTable } from "./CalendarTable";
import { PosterImageDialog } from "./PosterImageDialog";
import { PosterImagesActionsCard } from "./PosterImagesActionsCard";
import { usePosterImageFlow } from "@/hooks/usePosterImageFlow";
import { PosterLookControls } from "./PosterLookControls";

interface CalendarPreviewProps {
  rows: CalendarPost[];
}

export function CalendarPreview({ rows }: CalendarPreviewProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [posterLook, setPosterLook] = useState<PosterLookId>("text_only");
  const [posterLookCustom, setPosterLookCustom] = useState("");
  const poster = usePosterImageFlow({ posterLook, posterLookCustom });
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Calendar preview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pulled from the generated workbook for quick QA before sending to the client team.
              </p>
            </div>
            {rows.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void handleCopySheet()}
                aria-label="Copy entire calendar as tab-separated text for Google Sheets"
              >
                <Copy className="h-4 w-4" />
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                    ? "Copy blocked — try again"
                    : "Copy for Google Sheets"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {rows.length > 0 ? (
          <div className="border-b bg-muted/15 px-6 py-4">
            <PosterLookControls
              posterLook={posterLook}
              onPosterLookChange={setPosterLook}
              posterLookCustom={posterLookCustom}
              onPosterLookCustomChange={setPosterLookCustom}
            />
          </div>
        ) : null}
        <CardContent className="max-h-[480px] overflow-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No preview rows yet.</p>
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
