"use client";

export function ReviewDiffViewer({ original, edited }: { original: string; edited: string }): JSX.Element {
  if (original === edited) {
    return <p className="text-slate-600">No caption edits.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Original</p>
        <p className="whitespace-pre-wrap rounded-md border bg-white p-2 text-slate-800">{original}</p>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Client version</p>
        <p className="whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50/80 p-2 text-slate-900">{edited}</p>
      </div>
    </div>
  );
}
