"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientBrandKit } from "@/lib/types";
import type { PosterImageOutputState } from "@/lib/types";
import { getApiErrorMessage } from "@/lib/api";
import { useRefinePosterImage } from "@/hooks/useGenerator";

interface PosterRefineControlsProps {
  imageSrc: string;
  mimeType: string;
  brandKit?: ClientBrandKit | null;
  imageOutput: PosterImageOutputState;
  onRefined: (src: string, mimeType: string) => void;
}

function base64FromDataUrl(src: string): string | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(src);
  if (!m) return null;
  return m[2] ?? null;
}

function mimeFromDataUrl(src: string): string | null {
  const m = /^data:([^;]+);base64,/i.exec(src);
  return m?.[1] ?? null;
}

export function PosterRefineControls({
  imageSrc,
  mimeType,
  brandKit,
  imageOutput,
  onRefined,
}: PosterRefineControlsProps) {
  const [instruction, setInstruction] = useState("");
  const refine = useRefinePosterImage();

  async function handleRefine(): Promise<void> {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    const b64 = base64FromDataUrl(imageSrc);
    const mime = mimeFromDataUrl(imageSrc) ?? mimeType;
    if (!b64) {
      window.alert("Could not read the poster image. Try generating the poster again.");
      return;
    }

    const data = await refine.mutateAsync({
      imageBase64: b64,
      imageMimeType: mime,
      editInstruction: trimmed,
      ...imageOutput,
      ...(brandKit ? { brandKit } : {}),
    });
    onRefined(`data:${data.mimeType};base64,${data.imageBase64}`, data.mimeType);
    setInstruction("");
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-3">
      <Label htmlFor="refine-instruction" className="text-xs font-medium">
        Remove or replace elements
      </Label>
      <p className="text-xs text-muted-foreground">
        Describe what to change (e.g. &quot;Remove the background photo&quot;, &quot;Replace icon with heart symbol&quot;).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="refine-instruction"
          placeholder="e.g. Remove the decorative border"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={refine.isPending}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={!instruction.trim() || refine.isPending}
          onClick={() => void handleRefine()}
        >
          {refine.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Apply edit
        </Button>
      </div>
      {refine.isError ? (
        <p className="text-xs text-destructive">{getApiErrorMessage(refine.error)}</p>
      ) : null}
    </div>
  );
}
