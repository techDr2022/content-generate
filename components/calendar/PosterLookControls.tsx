import type { PosterLookId } from "@/lib/types";
import { POSTER_LOOK_IDS, POSTER_LOOK_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface PosterLookControlsProps {
  posterLook: PosterLookId;
  onPosterLookChange: (value: PosterLookId) => void;
  posterLookCustom: string;
  onPosterLookCustomChange: (value: string) => void;
  onApplyToAllRows?: () => void;
  rowCount?: number;
  /** Shown under the look selector (e.g. calendar Select rows vs job preview). */
  hint?: string;
}

export function PosterLookControls({
  posterLook,
  onPosterLookChange,
  posterLookCustom,
  onPosterLookCustomChange,
  onApplyToAllRows,
  rowCount = 0,
  hint,
}: PosterLookControlsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="poster-look">How should the poster look?</Label>
        <Select value={posterLook} onValueChange={(v) => onPosterLookChange(v as PosterLookId)}>
          <SelectTrigger id="poster-look" className="w-full max-w-md">
            <SelectValue placeholder="Choose a look" />
          </SelectTrigger>
          <SelectContent>
            {POSTER_LOOK_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_LOOK_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint !== undefined ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : onApplyToAllRows ? (
          <p className="text-xs text-muted-foreground">
            Default look for new rows. Set each row&apos;s look in the table or poster list below, then use{" "}
            <span className="font-medium text-foreground">Generate selected</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Applies to all selected rows when you use{" "}
            <span className="font-medium text-foreground">Generate selected</span>.
          </p>
        )}
        {onApplyToAllRows && rowCount > 0 ? (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onApplyToAllRows}>
            Apply this look to all {rowCount} rows
          </Button>
        ) : null}
      </div>
      {posterLook === "custom" ? (
        <div className="space-y-2">
          <Label htmlFor="poster-look-custom">Custom poster instructions</Label>
          <Textarea
            id="poster-look-custom"
            value={posterLookCustom}
            onChange={(e) => onPosterLookCustomChange(e.target.value)}
            placeholder="e.g. Pastel palette, single hero icon, large headline area at top…"
            rows={3}
            className="max-w-2xl resize-y text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
