import type { PosterLookId } from "@/lib/types";
import { POSTER_LOOK_IDS, POSTER_LOOK_LABELS } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface PosterLookControlsProps {
  posterLook: PosterLookId;
  onPosterLookChange: (value: PosterLookId) => void;
  posterLookCustom: string;
  onPosterLookCustomChange: (value: string) => void;
}

export function PosterLookControls({
  posterLook,
  onPosterLookChange,
  posterLookCustom,
  onPosterLookCustomChange,
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
        <p className="text-xs text-muted-foreground">
          Every poster uses a short <span className="font-medium text-foreground">professional healthcare</span> safety
          baseline, then each row&apos;s <span className="font-medium text-foreground">Text in image</span> copy. This menu
          adds optional layout/style direction (or only the baseline + your text).
        </p>
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
