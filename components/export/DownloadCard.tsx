import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DownloadCardProps {
  jobId: string;
  clientName: string;
  month: number;
  year: number;
  className?: string;
}

export function DownloadCard({ jobId, clientName, month, year, className }: DownloadCardProps) {
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
    <Card className={cn("border-emerald-200 bg-emerald-50/40 shadow-sm", className)}>
      <CardHeader className="space-y-1 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
        <CardTitle className="text-base sm:text-lg">Export ready</CardTitle>
        <p className="text-sm text-muted-foreground">
          {clientName} · {month}/{year}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <Button className="w-full sm:w-auto" onClick={() => void download()}>
          <Download className="mr-2 h-4 w-4" />
          Download Excel
        </Button>
      </CardContent>
    </Card>
  );
}
