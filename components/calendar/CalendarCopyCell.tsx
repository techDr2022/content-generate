"use client";

import type { CalendarPost } from "@/lib/types";
import type { RegenerateCalendarField } from "@/hooks/useGenerator";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarCopyCellProps {
  value: string;
  field: RegenerateCalendarField;
  post: CalendarPost;
  rowIndex: number;
  clientId?: string;
  loadingKey: string | null;
  onRegenerate: (rowIndex: number, field: RegenerateCalendarField, post: CalendarPost) => void;
}

export function calendarCopyLoadingKey(rowIndex: number, field: RegenerateCalendarField): string {
  return `${rowIndex}-${field}`;
}

export function CalendarCopyCell({
  value,
  field,
  post,
  rowIndex,
  clientId,
  loadingKey,
  onRegenerate,
}: CalendarCopyCellProps) {
  const key = calendarCopyLoadingKey(rowIndex, field);
  const busy = loadingKey === key;
  const hasContent = Boolean(value?.trim());
  const disabled = !clientId || busy;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className={cn("whitespace-pre-line", !hasContent && "italic text-muted-foreground")}>
        {hasContent ? value : "—"}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-fit gap-1 px-2 text-[10px] sm:text-xs"
        disabled={disabled}
        onClick={() => onRegenerate(rowIndex, field, post)}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3 w-3" aria-hidden />
        )}
        {busy ? "…" : hasContent ? "Regenerate" : "AI Generate"}
      </Button>
    </div>
  );
}
