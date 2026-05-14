"use client";

import type { PosterBrandAssetsState } from "@/lib/types";
import { POSTER_CONTACT_DETAILS_MAX_CHARS } from "@/lib/types";
import NextImage from "next/image";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ACCEPT_IMAGES = "image/png,image/jpeg,image/webp";
const CLIENT_MAX_READ = 6 * 1024 * 1024;

interface PosterBrandAssetsControlsProps {
  value: PosterBrandAssetsState;
  onChange: (patch: Partial<PosterBrandAssetsState>) => void;
}

function readImageFile(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > CLIENT_MAX_READ) {
      reject(new Error(`Image must be under ${Math.round(CLIENT_MAX_READ / (1024 * 1024))} MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const m = /^data:([^;]+);base64,(.+)$/.exec(r);
      if (!m) {
        reject(new Error("Could not read file"));
        return;
      }
      let mime = m[1]!;
      if (mime === "image/jpg") mime = "image/jpeg";
      if (!/^image\/(png|jpeg|webp)$/i.test(mime)) {
        reject(new Error("Use PNG, JPEG, or WebP."));
        return;
      }
      resolve({ base64: m[2]!, mimeType: mime });
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function PosterBrandAssetsControls({ value, onChange }: PosterBrandAssetsControlsProps) {
  const logoPreview = value.logoBase64 && value.logoMimeType ? `data:${value.logoMimeType};base64,${value.logoBase64}` : null;
  const doctorPreview =
    value.doctorPhotoBase64 && value.doctorPhotoMimeType
      ? `data:${value.doctorPhotoMimeType};base64,${value.doctorPhotoBase64}`
      : null;

  async function onPickLogo(f: FileList | null): Promise<void> {
    const file = f?.[0];
    if (!file) return;
    try {
      const { base64, mimeType } = await readImageFile(file);
      onChange({ logoBase64: base64, logoMimeType: mimeType });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not read logo");
    }
  }

  async function onPickDoctor(f: FileList | null): Promise<void> {
    const file = f?.[0];
    if (!file) return;
    try {
      const { base64, mimeType } = await readImageFile(file);
      onChange({ doctorPhotoBase64: base64, doctorPhotoMimeType: mimeType });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not read photo");
    }
  }

  return (
    <div className="space-y-5 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/10 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Brand &amp; practice details</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Logo and doctor photo are sent to the image model as reference images (GPT image models). Contact
          lines are added to the prompt as text to render on the poster.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="poster-contact-details">Contact details (on poster)</Label>
        <Textarea
          id="poster-contact-details"
          rows={4}
          placeholder="e.g. Dr Name · +91 … · clinic@email.com · Address · www…"
          value={value.contactDetails}
          maxLength={POSTER_CONTACT_DETAILS_MAX_CHARS}
          onChange={(e) => onChange({ contactDetails: e.target.value })}
          className="max-w-2xl resize-y text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {value.contactDetails.length}/{POSTER_CONTACT_DETAILS_MAX_CHARS} characters
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Practice logo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <label className="cursor-pointer">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Upload logo
                <input
                  type="file"
                  accept={ACCEPT_IMAGES}
                  className="sr-only"
                  onChange={(e) => void onPickLogo(e.target.files)}
                />
              </label>
            </Button>
            {value.logoBase64 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={() => onChange({ logoBase64: null, logoMimeType: null })}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {logoPreview ? (
            <NextImage
              src={logoPreview}
              alt="Logo preview"
              width={320}
              height={128}
              unoptimized
              className={cn("mt-2 h-20 w-auto max-w-full rounded border bg-white object-contain p-1")}
            />
          ) : (
            <div className="mt-2 flex h-20 max-w-[200px] items-center justify-center rounded border border-dashed bg-muted/30 text-muted-foreground">
              <ImagePlus className="h-8 w-8 opacity-50" aria-hidden />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Doctor photo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <label className="cursor-pointer">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Upload photo
                <input
                  type="file"
                  accept={ACCEPT_IMAGES}
                  className="sr-only"
                  onChange={(e) => void onPickDoctor(e.target.files)}
                />
              </label>
            </Button>
            {value.doctorPhotoBase64 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={() => onChange({ doctorPhotoBase64: null, doctorPhotoMimeType: null })}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          {doctorPreview ? (
            <NextImage
              src={doctorPreview}
              alt="Doctor preview"
              width={96}
              height={112}
              unoptimized
              className="mt-2 h-28 w-24 rounded border bg-white object-cover"
            />
          ) : (
            <div className="mt-2 flex h-28 w-24 items-center justify-center rounded border border-dashed bg-muted/30 text-muted-foreground">
              <ImagePlus className="h-8 w-8 opacity-50" aria-hidden />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
