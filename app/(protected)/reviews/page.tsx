"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, getApiErrorMessage } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { SessionStatusBadge } from "@/components/review/SessionStatusBadge";

type Row = {
  id: string;
  clientName: string;
  calendarMonth: number;
  calendarYear: number;
  status: string;
  email: string | null;
  expiresAt: string;
  createdAt: string;
  progress: { reviewed: number; total: number };
  reviewUrl: string;
};

export default function ReviewsListPage(): JSX.Element {
  const [status, setStatus] = useState<string>("all");
  const q = useQuery({
    queryKey: ["review-sessions", status],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("limit", "50");
      qs.set("page", "1");
      if (status !== "all") qs.set("status", status);
      const res = await api.get<{ success: boolean; data: { items: Row[] } }>(`/api/review/sessions?${qs.toString()}`);
      return res.data.data?.items ?? [];
    },
  });

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: "clientName", header: "Client" },
      {
        id: "cal",
        header: "Calendar",
        cell: ({ row }) => `${row.original.calendarMonth}/${row.original.calendarYear}`,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <SessionStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "email",
        header: "Sent to",
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: "Sent at",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) => new Date(row.original.expiresAt).toLocaleString(),
      },
      {
        id: "prog",
        header: "Progress",
        cell: ({ row }) => `${row.original.progress.reviewed}/${row.original.progress.total}`,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/reviews/${row.original.id}`}>View</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await api.post(`/api/review/sessions/${row.original.id}/resend`);
                  void q.refetch();
                } catch (e) {
                  alert(getApiErrorMessage(e));
                }
              }}
            >
              Resend
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(row.original.reviewUrl)}
            >
              Copy link
            </Button>
          </div>
        ),
      },
    ],
    [q]
  );

  const table = useReactTable({
    data: q.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageWrapper title="Client reviews" description="Track token-gated review sessions and client feedback on calendars.">
      <div className="mb-4 flex max-w-xs flex-col gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="OPENED">Opened</SelectItem>
            <SelectItem value="IN_REVIEW">In review</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                  {q.isLoading ? "Loading…" : "No review sessions yet."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
}
