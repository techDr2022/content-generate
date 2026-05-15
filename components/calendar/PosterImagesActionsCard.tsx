import type { CalendarPost } from "@/lib/types";
import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { posterRowKey } from "@/hooks/usePosterImageFlow";

function truncateText(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

interface PosterImagesActionsCardProps {
  rows: CalendarPost[];
  onGeneratePoster: (post: CalendarPost, rowIndex: number) => void;
  posterLoadingKey: string | null;
  posterPending: boolean;
  posterGenerateBlocked: boolean;
}

export function PosterImagesActionsCard({
  rows,
  onGeneratePoster,
  posterLoadingKey,
  posterPending,
  posterGenerateBlocked,
}: PosterImagesActionsCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200/90 shadow-sm dark:border-slate-800">
      <CardHeader className="space-y-2 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
        <CardTitle className="text-lg leading-tight sm:text-xl">Poster images</CardTitle>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Each row uses <span className="font-medium text-foreground">Text in image</span> plus the poster look above. You
          can also use the <span className="font-medium text-foreground">Poster</span> column in the table.
        </p>
      </CardHeader>
      <CardContent className="max-h-[min(52dvh,480px)] space-y-2 overflow-y-auto overscroll-y-contain px-4 pb-4 pt-0 [-webkit-overflow-scrolling:touch] sm:max-h-[min(56dvh,520px)] sm:px-6 sm:pb-6">
        {rows.map((row, index) => {
          const key = posterRowKey(row, index);
          const text = row.textInImage?.trim();
          const busy = posterPending && posterLoadingKey === key;
          const disabled = !text || busy || posterGenerateBlocked;

          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-card p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 dark:border-slate-800"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium text-foreground">{row.date}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {text ? truncateText(text, 220) : <span className="italic">No text in image</span>}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 w-full shrink-0 gap-2 sm:h-9 sm:w-auto sm:self-center"
                disabled={disabled}
                onClick={() => void onGeneratePoster(row, index)}
                aria-label={`Generate poster image for ${row.date}`}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                )}
                {busy ? "Generating…" : "Generate image"}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
