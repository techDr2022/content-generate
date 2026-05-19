"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultPosterBrandAssetsState,
  defaultPosterImageOutputState,
  posterBrandPayloadFromState,
  type CalendarPost,
  type ClientBrandKit,
  type PosterBrandAssetsState,
  type PosterImageOutputState,
  type PosterLookId,
} from "@/lib/types";
import {
  applyDefaultLookToAllRows,
  buildInitialRowLooks,
  type RowPosterLook,
} from "@/lib/posterRowLooks";
import { isRowPosterLookBlocked } from "@/lib/posterRowLooks";
import { parseDoctorNames, resolveDoctorForPosterIndex } from "@/lib/doctors";
import { defaultContactFromBrandKit } from "@/lib/posterLayout";
import type { BrandType } from "@/lib/types";
import { ChevronDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyCalendarPostsForSheets } from "@/lib/calendarSheetExport";
import { CalendarTable } from "./CalendarTable";
import { PosterImageDialog } from "./PosterImageDialog";
import { PosterImagesActionsCard, type PosterBulkResult } from "./PosterImagesActionsCard";
import { usePosterImageFlow } from "@/hooks/usePosterImageFlow";
import {
  useGeneratePosterImage,
  useRegenerateCalendarField,
  type RegenerateCalendarField,
} from "@/hooks/useGenerator";
import { useClient } from "@/hooks/useClients";
import { PosterBrandAssetsControls } from "./PosterBrandAssetsControls";
import { PosterImageOutputControls } from "./PosterImageOutputControls";
import { PosterLookControls } from "./PosterLookControls";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CalendarPreviewProps {
  rows: CalendarPost[];
  /** Required for AI copy regen and brand-aware poster generation. */
  clientId?: string;
}

function extFromMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "png";
}

export function CalendarPreview({ rows, clientId }: CalendarPreviewProps) {
  const [localRows, setLocalRows] = useState<CalendarPost[]>(rows);
  const [copyLoadingKey, setCopyLoadingKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const [defaultPosterLook, setDefaultPosterLook] = useState<PosterLookId>("text_only");
  const [defaultPosterLookCustom, setDefaultPosterLookCustom] = useState("");
  const [rowLooks, setRowLooks] = useState<Record<number, RowPosterLook>>(() =>
    buildInitialRowLooks(rows.length)
  );

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<PosterBulkResult[]>([]);

  const [imageOutput, setImageOutput] = useState<PosterImageOutputState>(() => defaultPosterImageOutputState());
  const [brandAssets, setBrandAssets] = useState<PosterBrandAssetsState>(() => defaultPosterBrandAssetsState());

  const clientQuery = useClient(clientId);
  const clientRecord = clientQuery.data;
  const clientBrandKit: ClientBrandKit | null = clientRecord?.brandKit ?? null;
  const clientDoctors = useMemo(() => {
    if (!clientRecord) return [];
    return parseDoctorNames(clientRecord.doctorName, clientRecord.brandType as BrandType);
  }, [clientRecord]);

  useEffect(() => {
    setLocalRows(rows);
    setRowLooks(buildInitialRowLooks(rows.length, defaultPosterLook, defaultPosterLookCustom));
    setBulkResults([]);
    setBulkDone(0);
    setBulkTotal(0);
    setSelected(new Set());
  }, [rows]);

  useEffect(() => {
    const kit = clientRecord?.brandKit;
    if (kit?.defaultPosterLook) {
      setDefaultPosterLook(kit.defaultPosterLook);
      if (kit.defaultPosterLook === "custom" && kit.posterLookCustom) {
        setDefaultPosterLookCustom(kit.posterLookCustom);
      }
      setRowLooks(
        buildInitialRowLooks(
          localRows.length,
          kit.defaultPosterLook,
          kit.defaultPosterLook === "custom" ? (kit.posterLookCustom ?? "") : ""
        )
      );
    }
  }, [clientRecord?.id, clientRecord?.brandKit, localRows.length]);

  useEffect(() => {
    const c = clientRecord;
    if (!c?.brandKit?.posterFooter) return;
    const firstDoctor = parseDoctorNames(c.doctorName, c.brandType as BrandType)[0] ?? "";
    const preset = defaultContactFromBrandKit(c.brandKit, {
      doctorName: firstDoctor,
      clinicName: c.clinicName,
      city: c.city,
    });
    if (!preset) return;
    setBrandAssets((prev) => (prev.contactDetails.trim() ? prev : { ...prev, contactDetails: preset }));
  }, [clientRecord?.id, clientRecord?.brandKit, clientRecord?.clinicName, clientRecord?.city, clientRecord?.doctorName, clientRecord?.brandType]);

  const getRowLook = useCallback((rowIndex: number) => rowLooks[rowIndex], [rowLooks]);

  const featuredDoctorForRow = useCallback(
    (rowIndex: number) => {
      if (!clientRecord || clientDoctors.length === 0) return undefined;
      const rotate = Boolean(clientBrandKit?.rotateDoctors && clientDoctors.length > 1);
      return resolveDoctorForPosterIndex(clientDoctors, rowIndex, rotate);
    },
    [clientBrandKit?.rotateDoctors, clientDoctors, clientRecord]
  );

  const poster = usePosterImageFlow({
    posterLook: defaultPosterLook,
    posterLookCustom: defaultPosterLookCustom,
    getRowLook,
    imageOutput,
    brandAssets,
    brandKit: clientBrandKit,
    clinicName: clientRecord?.clinicName,
    city: clientRecord?.city,
    generationNotes: clientRecord?.generationNotes,
    featuredDoctorForRow,
  });

  const generateImage = useGeneratePosterImage();
  const regenerateField = useRegenerateCalendarField();

  const handleRegenerateField = useCallback(
    async (rowIndex: number, field: RegenerateCalendarField, post: CalendarPost) => {
      if (!clientId) return;
      const key = `${rowIndex}-${field}`;
      setCopyLoadingKey(key);
      try {
        const data = await regenerateField.mutateAsync({
          clientId,
          field,
          post,
          rowIndex,
        });
        setLocalRows((prev) =>
          prev.map((r, i) => (i === rowIndex ? { ...r, [field]: data.value } : r))
        );
      } catch (e) {
        window.alert(getApiErrorMessage(e));
      } finally {
        setCopyLoadingKey(null);
      }
    },
    [clientId, regenerateField]
  );

  const handleRowLookChange = useCallback((rowIndex: number, look: RowPosterLook) => {
    setRowLooks((prev) => ({ ...prev, [rowIndex]: look }));
  }, []);

  const handleApplyDefaultLookToAll = useCallback(() => {
    setRowLooks(
      applyDefaultLookToAllRows(localRows.length, defaultPosterLook, defaultPosterLookCustom)
    );
  }, [defaultPosterLook, defaultPosterLookCustom, localRows.length]);

  const toggleRowSelected = useCallback((rowIndex: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowIndex);
      else next.delete(rowIndex);
      return next;
    });
  }, []);

  const selectedRunnableCount = useMemo(() => {
    let count = 0;
    for (const rowIndex of selected) {
      const post = localRows[rowIndex];
      const text = post?.textInImage?.trim();
      const look = rowLooks[rowIndex];
      if (text && look && !isRowPosterLookBlocked(look)) count++;
    }
    return count;
  }, [localRows, rowLooks, selected]);

  const handleGenerateSelected = useCallback(async () => {
    const items = localRows
      .map((post, rowIndex) => {
        if (!selected.has(rowIndex)) return null;
        const text = post.textInImage?.trim();
        const look = rowLooks[rowIndex];
        if (!text || !look || isRowPosterLookBlocked(look)) return null;
        return { post, rowIndex, text, look };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length === 0) return;

    setBulkRunning(true);
    setBulkResults([]);
    setBulkTotal(items.length);
    setBulkDone(0);

    const ok: PosterBulkResult[] = [];

    for (let step = 0; step < items.length; step++) {
      const { post, rowIndex, text, look } = items[step]!;
      try {
        const data = await generateImage.mutateAsync({
          textInImage: text,
          posterLook: look.posterLook,
          posterLookCustom: look.posterLook === "custom" ? look.posterLookCustom.trim() : undefined,
          contentStyle: post.style,
          ...imageOutput,
          ...posterBrandPayloadFromState(brandAssets),
          ...(clientBrandKit ? { brandKit: clientBrandKit } : {}),
          ...(clientRecord?.clinicName ? { clinicName: clientRecord.clinicName } : {}),
          ...(clientRecord?.city ? { city: clientRecord.city } : {}),
          ...(clientRecord?.generationNotes?.trim()
            ? { generationNotes: clientRecord.generationNotes.trim() }
            : {}),
          ...(featuredDoctorForRow(rowIndex)
            ? { featuredDoctor: featuredDoctorForRow(rowIndex) }
            : {}),
        });
        const safeSlug = post.date.replace(/[^\w\-]+/g, "_");
        ok.push({
          rowIndex,
          date: post.date,
          src: `data:${data.mimeType};base64,${data.imageBase64}`,
          mimeType: data.mimeType,
          fileName: `poster-${safeSlug}.${extFromMime(data.mimeType)}`,
        });
      } catch (e) {
        window.alert(`${post.date}: ${getApiErrorMessage(e)}`);
      }
      setBulkDone(step + 1);
      await new Promise((r) => setTimeout(r, 350));
    }

    setBulkResults(ok);
    setBulkRunning(false);
  }, [
    brandAssets,
    clientBrandKit,
    clientRecord?.city,
    clientRecord?.clinicName,
    clientRecord?.generationNotes,
    featuredDoctorForRow,
    generateImage,
    imageOutput,
    localRows,
    rowLooks,
    selected,
  ]);

  async function handleCopySheet(): Promise<void> {
    try {
      await copyCalendarPostsForSheets(localRows);
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
          posterLook={defaultPosterLook}
          onPosterLookChange={setDefaultPosterLook}
          posterLookCustom={defaultPosterLookCustom}
          onPosterLookCustomChange={setDefaultPosterLookCustom}
          onApplyToAllRows={handleApplyDefaultLookToAll}
          rowCount={localRows.length}
        />
        <PosterBrandAssetsControls
          value={brandAssets}
          onChange={(patch) => setBrandAssets((prev) => ({ ...prev, ...patch }))}
          hasSavedFooter={Boolean(clientBrandKit?.posterFooter)}
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
                Regenerate copy per cell, pick a poster look per row, then generate posters individually or for
                selected rows.
              </p>
            </div>
            {localRows.length > 0 ? (
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
        {localRows.length > 0 ? (
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
          {localRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">No preview rows yet.</p>
          ) : (
            <CalendarTable
              rows={localRows}
              clientId={clientId}
              onGeneratePoster={poster.generateFromPost}
              onRegenerateField={handleRegenerateField}
              posterLoadingKey={poster.loadingKey}
              copyLoadingKey={copyLoadingKey}
              posterPending={poster.isPending}
              rowLooks={rowLooks}
              onRowLookChange={handleRowLookChange}
            />
          )}
        </CardContent>
      </Card>

      {localRows.length > 0 ? (
        <PosterImagesActionsCard
          rows={localRows}
          rowLooks={rowLooks}
          selected={selected}
          onToggleRowSelected={toggleRowSelected}
          onSelectAllRows={() => setSelected(new Set(localRows.map((_, i) => i)))}
          onClearSelection={() => setSelected(new Set())}
          selectedRunnableCount={selectedRunnableCount}
          onRowLookChange={handleRowLookChange}
          onGeneratePoster={poster.generateFromPost}
          onGenerateSelected={() => void handleGenerateSelected()}
          posterLoadingKey={poster.loadingKey}
          posterPending={poster.isPending || bulkRunning}
          bulkRunning={bulkRunning}
          bulkDone={bulkDone}
          bulkTotal={bulkTotal}
          bulkResults={bulkResults}
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
