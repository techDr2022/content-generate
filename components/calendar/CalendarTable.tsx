import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { CalendarPost } from "@/lib/types";
import { ImageIcon, Loader2 } from "lucide-react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { posterRowKey } from "@/hooks/usePosterImageFlow";
import { cn } from "@/lib/utils";

interface CalendarTableProps {
  rows: CalendarPost[];
  onGeneratePoster: (post: CalendarPost, rowIndex: number) => void;
  posterLoadingKey: string | null;
  posterPending: boolean;
  /** True when “Custom” look is selected but instructions are empty */
  posterGenerateBlocked: boolean;
}

function cellClassForColumn(columnId: string): string {
  switch (columnId) {
    case "textInImage":
    case "supportingText":
      return "max-w-[10rem] min-w-[6.5rem] whitespace-normal break-words text-[11px] leading-snug sm:max-w-[18rem] sm:text-xs";
    case "department":
    case "style":
      return "max-w-[6.5rem] whitespace-normal break-words text-[11px] sm:max-w-[9rem] sm:text-xs";
    case "posterImage":
      return "whitespace-nowrap";
    case "date":
    case "code":
    case "type":
      return "whitespace-nowrap text-[11px] sm:text-xs";
    default:
      return "text-[11px] sm:text-xs";
  }
}

export function CalendarTable({
  rows,
  onGeneratePoster,
  posterLoadingKey,
  posterPending,
  posterGenerateBlocked,
}: CalendarTableProps) {
  const columns = useMemo<ColumnDef<CalendarPost>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "code", header: "Code" },
      { accessorKey: "department", header: "Dept" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "style", header: "Style" },
      { accessorKey: "textInImage", header: "Text in image" },
      { accessorKey: "supportingText", header: "Supporting text" },
      {
        id: "posterImage",
        header: "Poster",
        cell: ({ row }) => {
          const key = posterRowKey(row.original, row.index);
          const busy = posterPending && posterLoadingKey === key;
          const text = row.original.textInImage?.trim();
          const disabled = !text || busy || posterGenerateBlocked;

          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex h-10 w-10 shrink-0 items-center justify-center p-0 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
              disabled={disabled}
              onClick={() => void onGeneratePoster(row.original, row.index)}
              aria-label={`Generate poster image from text for ${row.original.date}`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden />
              ) : (
                <ImageIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">{busy ? "Generating…" : "Generate"}</span>
            </Button>
          );
        },
      },
    ],
    [onGeneratePoster, posterGenerateBlocked, posterLoadingKey, posterPending]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      className={cn(
        "relative max-h-[min(72dvh,720px)] w-full overflow-auto rounded-b-lg [-webkit-overflow-scrolling:touch]",
        "border-t border-slate-200/80 bg-gradient-to-b from-slate-50/40 to-background dark:border-slate-800/80 dark:from-slate-950/50"
      )}
    >
      <table className="w-full min-w-[880px] caption-bottom border-collapse text-sm">
        <TableHeader className="sticky top-0 z-20 border-b border-slate-200/90 bg-background/95 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-background/90">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="border-b border-slate-200/80 hover:bg-transparent dark:border-slate-800">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-9 whitespace-nowrap px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:h-11 sm:px-3 sm:text-xs sm:normal-case sm:tracking-normal"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-slate-100 transition-colors hover:bg-primary/[0.03] dark:border-slate-800/80 dark:hover:bg-primary/[0.06]"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn("align-top p-2 sm:p-2.5", cellClassForColumn(cell.column.id))}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
