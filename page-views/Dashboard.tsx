"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClients } from "@/hooks/useClients";
import { useJobs } from "@/hooks/useJobs";
import type { GenerationJobDTO } from "@/lib/types";
import { api } from "@/lib/api";
import {
  defaultDayInput,
  defaultMonthInput,
  jobCreatedInPeriod,
  periodLabel,
  type DashboardPeriod,
} from "@/lib/dashboardPeriod";

function statusBadge(status: GenerationJobDTO["status"]) {
  if (status === "done") return <Badge variant="success">done</Badge>;
  if (status === "failed") return <Badge variant="danger">failed</Badge>;
  if (status === "cancelled") return <Badge variant="secondary">cancelled</Badge>;
  if (status === "processing") return <Badge variant="warning">processing</Badge>;
  return <Badge variant="secondary">pending</Badge>;
}

export function DashboardPage() {
  const clients = useClients();
  const jobs = useJobs();

  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [monthKey, setMonthKey] = useState(() => defaultMonthInput());
  const [dayKey, setDayKey] = useState(() => defaultDayInput());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const periodOpts = useMemo(
    () => ({ monthKey, dayKey, from: rangeFrom, to: rangeTo }),
    [monthKey, dayKey, rangeFrom, rangeTo]
  );

  const filteredJobs = useMemo(() => {
    const list = jobs.data ?? [];
    if (period === "all") return list;
    return list.filter((j) => jobCreatedInPeriod(j, period, periodOpts));
  }, [jobs.data, period, periodOpts]);

  const periodName = periodLabel(period, { monthKey, dayKey });

  const stats = useMemo(() => {
    const list = jobs.data ?? [];
    const queued = list.filter((j) => j.status === "pending" || j.status === "processing").length;
    const ready = list.filter((j) => j.status === "done").length;
    const doneInPeriod = filteredJobs.filter((j) => j.status === "done");
    const rowsGenerated = doneInPeriod.reduce((sum, j) => sum + j.postCount, 0);
    const postersGenerated = doneInPeriod.reduce(
      (sum, j) => sum + (typeof j.posterCount === "number" ? j.posterCount : j.postCount),
      0
    );
    return {
      clients: clients.data?.length ?? 0,
      jobsInPeriod: filteredJobs.length,
      queued,
      ready,
      rowsGenerated,
      postersGenerated,
    };
  }, [clients.data, jobs.data, filteredJobs]);

  async function download(job: GenerationJobDTO): Promise<void> {
    const res = await api.get(`/api/jobs/${job.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendar-${job.client?.name ?? job.clientId}-${job.year}-${job.month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <PageWrapper
      title="Dashboard"
      description="Operational snapshot for your healthcare content production pipeline."
      actions={
        <Button asChild>
          <Link href="/generator">Quick generate</Link>
        </Button>
      }
    >
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Account</p>
            <p className="text-xs text-muted-foreground">Update your sign-in password anytime.</p>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0 gap-2" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Open settings
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Time period</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Filters rows, posters, jobs, and the table below. Queue and client totals are always current.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
              <Label htmlFor="dashboard-period">Show stats for</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
                <SelectTrigger id="dashboard-period" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "month" ? (
              <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                <Label htmlFor="dashboard-month">Month</Label>
                <Input
                  id="dashboard-month"
                  type="month"
                  className="mt-1"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                />
              </div>
            ) : null}
            {period === "day" ? (
              <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                <Label htmlFor="dashboard-day">Date</Label>
                <Input
                  id="dashboard-day"
                  type="date"
                  className="mt-1"
                  value={dayKey}
                  onChange={(e) => setDayKey(e.target.value)}
                />
              </div>
            ) : null}
            {period === "custom" ? (
              <>
                <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                  <Label htmlFor="dashboard-from">From</Label>
                  <Input
                    id="dashboard-from"
                    type="date"
                    className="mt-1"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                  />
                </div>
                <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                  <Label htmlFor="dashboard-to">To</Label>
                  <Input
                    id="dashboard-to"
                    type="date"
                    className="mt-1"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>
          {period !== "all" ? (
            <p className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{periodName}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Rows generated</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.rowsGenerated}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Posters generated</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.postersGenerated}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total clients</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.clients}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Jobs in period</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.jobsInPeriod}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">In queue / running</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.queued}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Files ready</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.ready}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
          {period !== "all" ? (
            <p className="text-xs text-muted-foreground font-normal">{periodName}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No jobs in this period.
                  </TableCell>
                </TableRow>
              ) : null}
              {filteredJobs.slice(0, 8).map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.client?.name ?? j.clientId}</TableCell>
                  <TableCell>{j.month}</TableCell>
                  <TableCell>{j.year}</TableCell>
                  <TableCell>{statusBadge(j.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(j.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {j.status === "done" ? (
                      <Button size="sm" variant="outline" onClick={() => void download(j)}>
                        Download
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}