import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PosterImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewSrc: string | null;
  previewMeta: { date: string; revisedPrompt?: string } | null;
  dialogError: string | null;
  showLoading: boolean;
}

export function PosterImageDialog({
  open,
  onOpenChange,
  previewSrc,
  previewMeta,
  dialogError,
  showLoading,
}: PosterImageDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>OpenAI poster preview</DialogTitle>
          <p className="text-left text-sm text-muted-foreground">
            Built for <span className="font-medium text-foreground">professional healthcare</span> marketing: your row&apos;s{" "}
            <span className="font-medium text-foreground">Text in image</span> plus the look you chose, via OpenAI Images
            (DALL·E). Proofread before publishing.
          </p>
        </DialogHeader>
        {previewMeta?.date ? (
          <p className="text-xs text-muted-foreground">
            Row date: <span className="text-foreground">{previewMeta.date}</span>
          </p>
        ) : null}
        {dialogError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {dialogError}
          </p>
        ) : null}
        {showLoading && !previewSrc && !dialogError ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Calling OpenAI — this can take 15–45 seconds.
          </div>
        ) : null}
        {previewSrc ? (
          <div className="space-y-3">
            <Image
              src={previewSrc}
              alt="Generated poster preview"
              width={1024}
              height={1024}
              unoptimized
              className="mx-auto max-h-[65vh] h-auto w-auto max-w-full rounded-md border object-contain"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" asChild>
                <a href={previewSrc} download={`poster-${previewMeta?.date ?? "image"}.png`}>
                  Download PNG
                </a>
              </Button>
            </div>
            {previewMeta?.revisedPrompt ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none text-foreground">Model revised prompt</summary>
                <p className="mt-2 whitespace-pre-wrap">{previewMeta.revisedPrompt}</p>
              </details>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
