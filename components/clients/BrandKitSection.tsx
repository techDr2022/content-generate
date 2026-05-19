"use client";

import {
  DEFAULT_POSTER_LOOK_POOL,
  POSTER_LOOK_IDS,
  POSTER_LOOK_LABELS,
  type ClientBrandKit,
  type PosterLookId,
} from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BrandKitFormState = ClientBrandKit;

interface BrandKitSectionProps {
  value: BrandKitFormState;
  onChange: (next: BrandKitFormState) => void;
}

function patchColors(
  value: BrandKitFormState,
  key: "primary" | "secondary" | "accent",
  hex: string
): BrandKitFormState {
  return {
    ...value,
    colors: { ...value.colors, [key]: hex || undefined },
  };
}

function toggleLookInPool(value: BrandKitFormState, look: PosterLookId, checked: boolean): BrandKitFormState {
  const current = value.posterLookPool ?? [];
  const next = checked
    ? current.includes(look)
      ? current
      : [...current, look]
    : current.filter((id) => id !== look);
  return { ...value, posterLookPool: next.length > 0 ? next : undefined };
}

const POOL_OPTIONS = POSTER_LOOK_IDS.filter((id) => id !== "text_only" && id !== "custom");

export function BrandKitSection({ value, onChange }: BrandKitSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Label className="text-base">Poster header &amp; footer</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved templates on every poster. Placeholders:{" "}
            <span className="font-mono">[Doctor Name]</span>, <span className="font-mono">[Clinic Name]</span>,{" "}
            <span className="font-mono">[City]</span>.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="poster-header" className="text-xs">
            Header template
          </Label>
          <Textarea
            id="poster-header"
            rows={2}
            maxLength={800}
            placeholder="e.g. [Doctor Name] · Consultant Cardiologist"
            value={value.posterHeader ?? ""}
            onChange={(e) => onChange({ ...value, posterHeader: e.target.value.trim() || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poster-footer" className="text-xs">
            Footer template (consistent on all posters)
          </Label>
          <Textarea
            id="poster-footer"
            rows={4}
            maxLength={2000}
            placeholder={"e.g. [Clinic Name] · [City]\n+91 … · www.clinic.com"}
            value={value.posterFooter ?? ""}
            onChange={(e) => onChange({ ...value, posterFooter: e.target.value.trim() || undefined })}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={value.rotateDoctors ?? false}
            onCheckedChange={(c) => onChange({ ...value, rotateDoctors: c === true })}
          />
          <span>
            Rotate doctors across bulk posters — each creative uses the next doctor in the header and in [Doctor Name].
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Brand colors</Label>
        <p className="text-xs text-muted-foreground">
          Hex colors applied to poster generation and referenced in calendar prompts.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="brand-primary" className="text-xs">
              Primary
            </Label>
            <Input
              id="brand-primary"
              placeholder="#0B5FFF"
              value={value.colors?.primary ?? ""}
              onChange={(e) => onChange(patchColors(value, "primary", e.target.value.trim()))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="brand-secondary" className="text-xs">
              Secondary
            </Label>
            <Input
              id="brand-secondary"
              placeholder="#00A3A3"
              value={value.colors?.secondary ?? ""}
              onChange={(e) => onChange(patchColors(value, "secondary", e.target.value.trim()))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="brand-accent" className="text-xs">
              Accent
            </Label>
            <Input
              id="brand-accent"
              placeholder="#F59E0B"
              value={value.colors?.accent ?? ""}
              onChange={(e) => onChange(patchColors(value, "accent", e.target.value.trim()))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Typography</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="font-heading" className="text-xs">
              Heading font
            </Label>
            <Input
              id="font-heading"
              placeholder="e.g. Montserrat Bold"
              value={value.typography?.headingFont ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  typography: { ...value.typography, headingFont: e.target.value.trim() || undefined },
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="font-body" className="text-xs">
              Body font
            </Label>
            <Input
              id="font-body"
              placeholder="e.g. Open Sans"
              value={value.typography?.bodyFont ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  typography: { ...value.typography, bodyFont: e.target.value.trim() || undefined },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Layout grid</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="grid-cols" className="text-xs">
              Columns (4–24)
            </Label>
            <Input
              id="grid-cols"
              type="number"
              min={4}
              max={24}
              placeholder="12"
              value={value.grid?.columns ?? ""}
              onChange={(e) => {
                const n = e.target.value === "" ? undefined : Number(e.target.value);
                onChange({
                  ...value,
                  grid: {
                    ...value.grid,
                    columns: n !== undefined && Number.isFinite(n) ? n : undefined,
                  },
                });
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grid-gutter" className="text-xs">
              Gutter (px)
            </Label>
            <Input
              id="grid-gutter"
              type="number"
              min={0}
              max={120}
              placeholder="16"
              value={value.grid?.gutterPx ?? ""}
              onChange={(e) => {
                const n = e.target.value === "" ? undefined : Number(e.target.value);
                onChange({
                  ...value,
                  grid: {
                    ...value.grid,
                    gutterPx: n !== undefined && Number.isFinite(n) ? n : undefined,
                  },
                });
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="design-guidelines" className="text-base">
          Design guidelines
        </Label>
        <p className="text-xs text-muted-foreground">
          Logo placement, imagery rules, tone, do/don’t lists — enforced in calendar copy and poster images.
        </p>
        <Textarea
          id="design-guidelines"
          rows={5}
          maxLength={12000}
          placeholder="e.g. Always use logo top-left; no stock photos of children; CTA button style…"
          value={value.designGuidelines ?? ""}
          onChange={(e) => onChange({ ...value, designGuidelines: e.target.value.trim() || undefined })}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.strictGuidelines ?? false}
            onCheckedChange={(c) => onChange({ ...value, strictGuidelines: c === true })}
          />
          Strict mode — model must not deviate from these rules
        </label>
      </div>

      <div className="space-y-3">
        <Label className="text-base">Default poster style</Label>
        <Select
          value={value.defaultPosterLook ?? "text_only"}
          onValueChange={(v) => onChange({ ...value, defaultPosterLook: v as PosterLookId })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POSTER_LOOK_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {POSTER_LOOK_LABELS[id]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.defaultPosterLook === "custom" ? (
          <Textarea
            rows={3}
            maxLength={500}
            placeholder="Custom poster art direction for this client…"
            value={value.posterLookCustom ?? ""}
            onChange={(e) => onChange({ ...value, posterLookCustom: e.target.value.trim() || undefined })}
          />
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={value.rotatePosterStyles ?? false}
            onCheckedChange={(c) => onChange({ ...value, rotatePosterStyles: c === true })}
          />
          <span>
            Rotate design styles when generating multiple posters — each creative uses a different look from the pool
            below (or defaults:{" "}
            {DEFAULT_POSTER_LOOK_POOL.map((id) => POSTER_LOOK_LABELS[id]).join(", ")}).
          </span>
        </label>

        {value.rotatePosterStyles ? (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Style pool for rotation</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {POOL_OPTIONS.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(value.posterLookPool ?? []).includes(id)}
                    onCheckedChange={(c) => toggleLookInPool(value, id, c === true)}
                  />
                  {POSTER_LOOK_LABELS[id]}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
