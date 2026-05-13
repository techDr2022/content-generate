import type { GenerationJobDTO } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BulkExportPanelProps {
  jobs: GenerationJobDTO[];
}

function statusVariant(
  status: GenerationJobDTO["status"]
): "default" | "secondary" | "success" | "warning" | "danger" | "outline" {
  if (status === "done") return "success";
  if (status === "failed") return "danger";
  if (status === "cancelled") return "outline";
  if (status === "processing") return "warning";
  return "secondary";
}

export function BulkExportPanel({ jobs }: BulkExportPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Live job grid</CardTitle>
        <p className="text-sm text-muted-foreground">Statuses refresh automatically over SSE.</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>{j.client?.name ?? j.clientId}</TableCell>
                <TableCell>{j.month}</TableCell>
                <TableCell>{j.year}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
