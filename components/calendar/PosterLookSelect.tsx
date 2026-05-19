"use client";

import { POSTER_LOOK_IDS, POSTER_LOOK_LABELS, type PosterLookId } from "@/lib/types";
import type { RowPosterLook } from "@/lib/posterRowLooks";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PosterLookSelectProps {
  value: RowPosterLook;
  onChange: (next: RowPosterLook) => void;
  idPrefix?: string;
  compact?: boolean;
  className?: string;
}

export function PosterLookSelect({
  value,
  onChange,
  idPrefix = "poster-look",
  compact = false,
  className,
}: PosterLookSelectProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Select
        value={value.posterLook}
        onValueChange={(v) => {
          const look = v as PosterLookId;
          onChange({
            posterLook: look,
            posterLookCustom: look === "custom" ? value.posterLookCustom : "",
          });
        }}
      >
        <SelectTrigger
          id={`${idPrefix}-select`}
          className={cn("w-full", compact ? "h-8 text-[11px]" : "max-w-md")}
        >
          <SelectValue placeholder="Poster look" />
        </SelectTrigger>
        <SelectContent>
          {POSTER_LOOK_IDS.map((id) => (
            <SelectItem key={id} value={id} className={compact ? "text-xs" : undefined}>
              {POSTER_LOOK_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.posterLook === "custom" ? (
        <div className="space-y-1">
          {!compact ? <Label htmlFor={`${idPrefix}-custom`} className="text-xs">Custom instructions</Label> : null}
          <Textarea
            id={`${idPrefix}-custom`}
            value={value.posterLookCustom}
            onChange={(e) => onChange({ ...value, posterLookCustom: e.target.value })}
            placeholder="Custom art direction…"
            rows={compact ? 2 : 3}
            className={cn("resize-y", compact ? "text-[11px]" : "text-sm")}
          />
        </div>
      ) : null}
    </div>
  );
}
