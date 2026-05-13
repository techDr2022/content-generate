import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  loading?: boolean;
  onClick: () => void;
  label?: string;
}

export function ExportButton({ loading, onClick, label = "Generate" }: ExportButtonProps) {
  return (
    <Button type="button" disabled={loading} onClick={onClick}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}
