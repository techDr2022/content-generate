"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClients } from "@/hooks/useClients";
import { useJobs } from "@/hooks/useJobs";
import type { GenerationJobDTO } from "@/lib/types";
import { api } from "@/lib/api";
import { TrendingHealthcareNewsPanel } from "@/components/dashboard/TrendingHealthcareNewsPanel";

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

  const stats = useMemo(() => {
    const list = jobs.data ?? [];
    const now = new Date();
    const inMonth = list.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const queued = list.filter((j) => j.status === "pending" || j.status === "processing").length;
    const ready = list.filter((j) => j.status === "done").length;
    return {
      clients: clients.data?.length ?? 0,
      jobsThisMonth: inMonth.length,
      queued,
      ready,
    };
  }, [clients.data, jobs.data]);

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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total clients</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.clients}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Jobs this month</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.jobsThisMonth}</CardContent>
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

      <TrendingHealthcareNewsPanel />

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(jobs.data ?? []).slice(0, 8).map((j) => (
                <TableRow key={j.id}>
                  <TableCell>{j.client?.name ?? j.clientId}</TableCell>
                  <TableCell>{j.month}</TableCell>
                  <TableCell>{j.year}</TableCell>
                  <TableCell>{statusBadge(j.status)}</TableCell>
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