import type { CalendarPost } from "@hc/shared";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Poster images from Text in image</CardTitle>
        <p className="text-sm text-muted-foreground">
          Uses each row&apos;s <span className="font-medium text-foreground">Text in image</span> only (plus the poster look
          chosen above). You can also use the table&apos;s <span className="font-medium text-foreground">Poster image</span>{" "}
          column.
        </p>
      </CardHeader>
      <CardContent className="max-h-[min(420px,60vh)] space-y-2 overflow-y-auto pr-1">
        {rows.map((row, index) => {
          const key = posterRowKey(row, index);
          const text = row.textInImage?.trim();
          const busy = posterPending && posterLoadingKey === key;
          const disabled = !text || busy || posterGenerateBlocked;

          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
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
                className="shrink-0 gap-1.5 self-start sm:self-center"
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
