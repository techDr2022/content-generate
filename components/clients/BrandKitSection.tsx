"use client";

import type { ClientBrandKit } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export function BrandKitSection({ value, onChange }: BrandKitSectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Label className="text-base">Post header &amp; footer templates</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved templates referenced in calendar copy. Placeholders:{" "}
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
            Footer template
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
            Rotate doctors across calendar rows — each row uses the next doctor in the header and in [Doctor Name].
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Brand colors</Label>
        <p className="text-xs text-muted-foreground">Hex colors referenced in calendar prompts.</p>
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
          Logo placement, imagery rules, tone, do/don’t lists — enforced in calendar copy.
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
    </div>
  );
}
