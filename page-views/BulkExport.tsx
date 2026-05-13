"use client";
import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportButton } from "@/components/export/ExportButton";
import { BulkExportPanel } from "@/components/export/BulkExportPanel";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
import { useEnqueueBulkGenerate, downloadBulkZip } from "@/hooks/useBulkExport";
import { useJobs } from "@/hooks/useJobs";
import { useJobProgress } from "@/hooks/useJobProgress";
import type { GenerationJobDTO } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BulkExportPage() {
  const clients = useClients();
  const jobs = useJobs();
  const bulk = useEnqueueBulkGenerate();

  const user = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { id: string };
    } catch {
      return null;
    }
  }, []);

  useJobProgress(user?.id);

  const [year, setYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sessionJobs, setSessionJobs] = useState<string[]>([]);

  function toggleClient(id: string): void {
    setSelectedClients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function generateAll(): Promise<void> {
    let sm = startMonth;
    let em = endMonth;
    if (sm > em) {
      const tmp = sm;
      sm = em;
      em = tmp;
    }
    const months: number[] = [];
    for (let m = sm; m <= em; m++) months.push(m);
    const jobsPayload = selectedClients.flatMap((clientId) =>
      months.map((month) => ({
        clientId,
        month,
        year,
      }))
    );
    const created = await bulk.mutateAsync(jobsPayload);
    setSessionJobs(created.map((j) => j.id));
  }

  const trackedJobs: GenerationJobDTO[] = useMemo(() => {
    const list = jobs.data ?? [];
    if (!sessionJobs.length) return [];
    return list.filter((j) => sessionJobs.includes(j.id));
  }, [jobs.data, sessionJobs]);

  const allDone =
    trackedJobs.length > 0 && trackedJobs.every((j) => j.status === "done");

  async function zipAll(): Promise<void> {
    const blob = await downloadBulkZip(sessionJobs);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendars.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <PageWrapper
      title="Bulk export"
      description="Spin up dozens of calendars for the quarter, watch BullMQ chew through them, then grab a single ZIP."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="year">Year</Label>
              <Input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start month</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                >
                  {MONTHS.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>End month</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={endMonth}
                  onChange={(e) => setEndMonth(Number(e.target.value))}
                >
                  {MONTHS.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Clients</Label>
              <ScrollArea className="mt-2 h-64 rounded-md border">
                <div className="space-y-2 p-3">
                  {(clients.data ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedClients.includes(c.id)} onCheckedChange={() => toggleClient(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <ExportButton loading={bulk.isPending} onClick={() => void generateAll()} label="Generate all" />
            <Button type="button" variant="outline" disabled={!allDone} onClick={() => void zipAll()}>
              Download all as ZIP
            </Button>
            {!allDone ? (
              <p className="text-xs text-muted-foreground">ZIP unlocks once every tracked job is done (LOCAL storage).</p>
            ) : null}
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <BulkExportPanel jobs={trackedJobs.length ? trackedJobs : (jobs.data ?? []).slice(0, 10)} />
        </div>
      </div>
    </PageWrapper>
  );
}