"use client";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJobs, useRegenerateJob } from "@/hooks/useJobs";
import { useClients } from "@/hooks/useClients";
import type { GenerationJobDTO } from "@/lib/types";
import { api } from "@/lib/api";

export function JobHistoryPage() {
  const jobs = useJobs();
  const clients = useClients();
  const regenerate = useRegenerateJob();

  const [status, setStatus] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    let list = jobs.data ?? [];
    if (status !== "all") {
      list = list.filter((j) => j.status === status);
    }
    if (clientId !== "all") {
      list = list.filter((j) => j.clientId === clientId);
    }
    if (from) {
      const t = new Date(from).getTime();
      list = list.filter((j) => new Date(j.createdAt).getTime() >= t);
    }
    if (to) {
      const t = new Date(to).getTime();
      list = list.filter((j) => new Date(j.createdAt).getTime() <= t);
    }
    return list;
  }, [jobs.data, status, clientId, from, to]);

  const columns = useMemo<ColumnDef<GenerationJobDTO>[]>(
    () => [
      { accessorKey: "client.name", header: "Client", cell: ({ row }) => row.original.client?.name ?? "—" },
      { accessorKey: "month", header: "Month" },
      { accessorKey: "year", header: "Year" },
      { accessorKey: "postCount", header: "Posts" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.status === "done" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await api.get(`/api/jobs/${row.original.id}/download`, { responseType: "blob" });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `calendar-${row.original.id}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                }}
              >
                Download
              </Button>
            ) : null}
            {row.original.status === "failed" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={regenerate.isPending}
                onClick={() => void regenerate.mutateAsync(row.original.id)}
              >
                Re-generate
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [regenerate]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageWrapper
      title="Job history"
      description="Audit every calendar generation, filter by client or status, and recover failed runs."
    >
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {(clients.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border bg-white">
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
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
}