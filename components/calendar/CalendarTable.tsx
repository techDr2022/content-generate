import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { CalendarPost } from "@/lib/types";
import type { RowPosterLook } from "@/lib/posterRowLooks";
import { isRowPosterLookBlocked } from "@/lib/posterRowLooks";
import { ImageIcon, Loader2 } from "lucide-react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { RegenerateCalendarField } from "@/hooks/useGenerator";
import { posterRowKey } from "@/hooks/usePosterImageFlow";
import { CalendarCopyCell } from "./CalendarCopyCell";
import { PosterLookSelect } from "./PosterLookSelect";
import { cn } from "@/lib/utils";

interface CalendarTableProps {
  rows: CalendarPost[];
  clientId?: string;
  onGeneratePoster: (post: CalendarPost, rowIndex: number) => void;
  onRegenerateField: (rowIndex: number, field: RegenerateCalendarField, post: CalendarPost) => void;
  posterLoadingKey: string | null;
  copyLoadingKey: string | null;
  posterPending: boolean;
  rowLooks: Record<number, RowPosterLook>;
  onRowLookChange: (rowIndex: number, look: RowPosterLook) => void;
}

function cellClassForColumn(columnId: string): string {
  switch (columnId) {
    case "textInImage":
    case "supportingText":
      return "max-w-[10rem] min-w-[6.5rem] whitespace-normal break-words text-[11px] leading-snug sm:max-w-[18rem] sm:text-xs";
    case "department":
    case "style":
      return "max-w-[6.5rem] whitespace-normal break-words text-[11px] sm:max-w-[9rem] sm:text-xs";
    case "posterLook":
      return "min-w-[10rem] max-w-[14rem] whitespace-normal";
    case "posterImage":
      return "whitespace-nowrap align-top";
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
  clientId,
  onGeneratePoster,
  onRegenerateField,
  posterLoadingKey,
  copyLoadingKey,
  posterPending,
  rowLooks,
  onRowLookChange,
}: CalendarTableProps) {
  const columns = useMemo<ColumnDef<CalendarPost>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      { accessorKey: "code", header: "Code" },
      { accessorKey: "department", header: "Dept" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "style", header: "Style" },
      {
        accessorKey: "textInImage",
        header: "Text in image",
        cell: ({ row }) => (
          <CalendarCopyCell
            value={row.original.textInImage}
            field="textInImage"
            post={row.original}
            rowIndex={row.index}
            clientId={clientId}
            loadingKey={copyLoadingKey}
            onRegenerate={onRegenerateField}
          />
        ),
      },
      {
        accessorKey: "supportingText",
        header: "Supporting text",
        cell: ({ row }) => (
          <CalendarCopyCell
            value={row.original.supportingText}
            field="supportingText"
            post={row.original}
            rowIndex={row.index}
            clientId={clientId}
            loadingKey={copyLoadingKey}
            onRegenerate={onRegenerateField}
          />
        ),
      },
      {
        id: "posterLook",
        header: "Poster look",
        cell: ({ row }) => {
          const look = rowLooks[row.index] ?? { posterLook: "text_only", posterLookCustom: "" };
          return (
            <PosterLookSelect
              compact
              idPrefix={`table-${row.index}-look`}
              value={look}
              onChange={(next) => onRowLookChange(row.index, next)}
            />
          );
        },
      },
      {
        id: "posterImage",
        header: "Poster",
        cell: ({ row }) => {
          const key = posterRowKey(row.original, row.index);
          const busy = posterPending && posterLoadingKey === key;
          const text = row.original.textInImage?.trim();
          const look = rowLooks[row.index] ?? { posterLook: "text_only", posterLookCustom: "" };
          const disabled = !text || busy || isRowPosterLookBlocked(look);

          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 flex h-9 w-full gap-1.5 sm:w-auto"
              disabled={disabled}
              onClick={() => void onGeneratePoster(row.original, row.index)}
              aria-label={`Generate poster image from text for ${row.original.date}`}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              )}
              {busy ? "…" : "Generate"}
            </Button>
          );
        },
      },
    ],
    [clientId, copyLoadingKey, onGeneratePoster, onRegenerateField, onRowLookChange, posterLoadingKey, posterPending, rowLooks]
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
      <table className="w-full min-w-[1040px] caption-bottom border-collapse text-sm">
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
