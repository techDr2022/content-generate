import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { CalendarPost } from "@/lib/types";
import { ImageIcon, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { posterRowKey } from "@/hooks/usePosterImageFlow";

interface CalendarTableProps {
  rows: CalendarPost[];
  onGeneratePoster: (post: CalendarPost, rowIndex: number) => void;
  posterLoadingKey: string | null;
  posterPending: boolean;
  /** True when “Custom” look is selected but instructions are empty */
  posterGenerateBlocked: boolean;
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
      { accessorKey: "department", header: "Department" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "style", header: "Style" },
      { accessorKey: "textInImage", header: "Text in image" },
      { accessorKey: "supportingText", header: "Supporting text" },
      {
        id: "posterImage",
        header: "Poster image",
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
              className="gap-1.5 whitespace-nowrap"
              disabled={disabled}
              onClick={() => void onGeneratePoster(row.original, row.index)}
              aria-label={`Generate poster image from text for ${row.original.date}`}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              )}
              {busy ? "Generating…" : "Generate"}
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
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className="align-top text-xs">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
