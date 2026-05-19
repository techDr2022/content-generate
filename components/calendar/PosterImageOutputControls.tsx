import type { PosterImageOutputState } from "@/lib/types";
import {
  POSTER_IMAGE_BACKGROUND_IDS,
  POSTER_IMAGE_BACKGROUND_LABELS,
  POSTER_IMAGE_FORMAT_IDS,
  POSTER_IMAGE_FORMAT_LABELS,
  POSTER_IMAGE_QUALITY_IDS,
  POSTER_IMAGE_QUALITY_LABELS,
  POSTER_IMAGE_SIZE_IDS,
  POSTER_IMAGE_SIZE_LABELS,
} from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PosterImageOutputControlsProps {
  value: PosterImageOutputState;
  onChange: (patch: Partial<PosterImageOutputState>) => void;
}

export function PosterImageOutputControls({ value, onChange }: PosterImageOutputControlsProps) {
  const compressionDisabled = value.outputFormat === "png";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="poster-image-size">Image size</Label>
        <Select value={value.imageSize} onValueChange={(v) => onChange({ imageSize: v as PosterImageOutputState["imageSize"] })}>
          <SelectTrigger id="poster-image-size" className="w-full max-w-md">
            <SelectValue placeholder="Choose a size" />
          </SelectTrigger>
          <SelectContent>
            {POSTER_IMAGE_SIZE_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_IMAGE_SIZE_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          DALL·E 3 uses the listed pixel sizes; GPT image models use the closest supported aspect (for example portrait
          1024 × 1536).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="poster-image-quality">Rendering quality</Label>
        <Select
          value={value.imageQuality}
          onValueChange={(v) => onChange({ imageQuality: v as PosterImageOutputState["imageQuality"] })}
        >
          <SelectTrigger id="poster-image-quality" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTER_IMAGE_QUALITY_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_IMAGE_QUALITY_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          GPT models accept auto / low / medium / high. Use High only when you need sharper logo or doctor-photo
          matching (slower). DALL·E 3 maps low–medium–auto to standard and high to HD.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="poster-output-format">File format</Label>
        <Select
          value={value.outputFormat}
          onValueChange={(v) => {
            const next = v as PosterImageOutputState["outputFormat"];
            onChange({
              outputFormat: next,
              ...(next === "png" ? { outputCompression: 100 } : {}),
            });
          }}
        >
          <SelectTrigger id="poster-output-format" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTER_IMAGE_FORMAT_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_IMAGE_FORMAT_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">PNG, JPEG, and WebP apply to GPT image models; DALL·E returns PNG.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="poster-output-compression" className={compressionDisabled ? "text-muted-foreground" : undefined}>
            Compression (JPEG / WebP)
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">{value.outputCompression}%</span>
        </div>
        <input
          id="poster-output-compression"
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={compressionDisabled}
          value={value.outputCompression}
          onChange={(e) => onChange({ outputCompression: Number(e.target.value) })}
          className="h-2 w-full max-w-md cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
        />
        <p className="text-xs text-muted-foreground">0–100% compression for JPEG and WebP on GPT image models (ignored for PNG).</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="poster-background">Background</Label>
        <Select value={value.background} onValueChange={(v) => onChange({ background: v as PosterImageOutputState["background"] })}>
          <SelectTrigger id="poster-background" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTER_IMAGE_BACKGROUND_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_IMAGE_BACKGROUND_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Opaque or automatic for GPT image models; ignored for DALL·E.</p>
      </div>
    </div>
  );
}
