import { Suspense } from "react";
import { ImageStudioPage } from "@/page-views/ImageStudio";

export default function PosterImages(): JSX.Element {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading poster studio…</div>}>
      <ImageStudioPage />
    </Suspense>
  );
}
