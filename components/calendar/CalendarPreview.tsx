"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarPost } from "@/lib/types";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyCalendarPostsForSheets } from "@/lib/calendarSheetExport";
import { CalendarTable } from "./CalendarTable";
import {
  useRegenerateCalendarField,
  type RegenerateCalendarField,
} from "@/hooks/useGenerator";
import { getApiErrorMessage } from "@/lib/api";

interface CalendarPreviewProps {
  rows: CalendarPost[];
  /** Required for AI copy regeneration. */
  clientId?: string;
}

export function CalendarPreview({ rows, clientId }: CalendarPreviewProps) {
  const [localRows, setLocalRows] = useState<CalendarPost[]>(rows);
  const [copyLoadingKey, setCopyLoadingKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="overflow-hidden border-slate-200/90 shadow-md dark:border-slate-800">
        <CardHeader className="space-y-3 px-4 pb-4 pt-5 sm:px-6 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg leading-tight sm:text-xl">Calendar preview</CardTitle>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                Review generated rows and regenerate copy per cell when needed.
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
        <CardContent className="p-0">
          {localRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">No preview rows yet.</p>
          ) : (
            <CalendarTable
              rows={localRows}
              clientId={clientId}
              onRegenerateField={handleRegenerateField}
              copyLoadingKey={copyLoadingKey}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
