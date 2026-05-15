"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PostLightboxProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  src: string | null;
  alt: string;
}

export function PostLightbox({ open, onOpenChange, src, alt }: PostLightboxProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[95vw] border-0 bg-black/95 p-2 sm:max-w-4xl">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="mx-auto max-h-[85vh] w-auto object-contain" />
        ) : (
          <p className="p-8 text-center text-sm text-white/80">No poster image for this post.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
