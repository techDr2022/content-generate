import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

interface DownloadCardProps {
  jobId: string;
  clientName: string;
  month: number;
  year: number;
}

export function DownloadCard({ jobId, clientName, month, year }: DownloadCardProps) {
  async function download(): Promise<void> {
    const res = await api.get(`/api/jobs/${jobId}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientName}-${year}-${String(month).padStart(2, "0")}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader>
        <CardTitle className="text-base">Export ready</CardTitle>
        <p className="text-sm text-muted-foreground">
          {clientName} · {month}/{year}
        </p>
      </CardHeader>
      <CardContent>
        <Button onClick={() => void download()}>
          <Download className="mr-2 h-4 w-4" />
          Download Excel
        </Button>
      </CardContent>
    </Card>
  );
}
